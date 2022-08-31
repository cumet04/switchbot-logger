package main

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"log"
	"os"
	"os/signal"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
)

type AdStructure struct {
	Time          time.Time
	DeviceAddress string
	AdType        int
	Data          string
}

type Record struct {
	Time     time.Time
	DeviceId string
	Type     RecordType
	Value    float32
}

type RecordType string

var RecordTypes = struct {
	Battery,
	Temperature,
	Humidity,
	PowerOn,
	Load RecordType
}{
	Battery:     "Battery",
	Temperature: "Temperature",
	Humidity:    "Humidity",
	PowerOn:     "PowerOn",
	Load:        "Load",
}

var elog = log.New(os.Stderr, "", log.LstdFlags)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	cStructs := make(chan AdStructure, 10)

	go func() {
		defer close(cStructs)

		ch := subscribe(ctx, "localhost:6379", "switchbot")
		for msg := range ch {
			var signal struct {
				Time    string `json:"time"`
				Addr    string `json:"addr"`
				Structs []struct {
					AdType int    `json:"adtype"`
					Desc   string `json:"desk"`
					Value  string `json:"value"`
				} `json:"structs"`
			}
			if err := json.Unmarshal([]byte(msg), &signal); err != nil {
				elog.Printf("unmarshal failed: %v\n", err)
				continue
			}

			t, err := time.Parse(time.RFC3339Nano, signal.Time)
			if err != nil {
				elog.Printf("time parse failed: %v\n", err)
				continue
			}

			for _, s := range signal.Structs {
				cStructs <- AdStructure{t, signal.Addr, s.AdType, s.Value}
			}
		}
	}()

	for s := range cStructs {
		processAdStructure(ctx, s)
	}
}

func subscribe(ctx context.Context, host string, channel string) <-chan string {
	rds := redis.NewClient(&redis.Options{Addr: host})
	pubsub := rds.Subscribe(ctx, channel)

	cPayload := make(chan string)

	go func() {
		defer pubsub.Close()
		defer close(cPayload)

		ch := pubsub.Channel()
		for {
			select {
			case <-ctx.Done():
				return
			case msg := <-ch:
				cPayload <- msg.Payload
			}
		}
	}()

	return cPayload
}

func processAdStructure(ctx context.Context, s AdStructure) {
	var records []Record
	var err error

	devType := getDeviceTypeFor(s.DeviceAddress)
	switch devType {
	case "Meter":
		records, err = parseMeterData(s)
	case "Plug Mini (US)":
		records, err = parsePlugData(s)
	case "_unknown_":
		return
	default:
		elog.Printf("unexpected device type: %s, addr: %s\n", devType, s.DeviceAddress)
		return
	}

	if err != nil {
		elog.Printf("failed to parse ad structure: %v\n, err: %v", s, err)
		return
	}

	if records == nil {
		return
	}

	for _, r := range records {
		if err := storeRecord(ctx, r); err != nil {
			elog.Printf("failed to store record: %v\n, err: %v", r, err)
		}
	}
}

func getDeviceTypeFor(addr string) string {
	bytes, err := os.ReadFile("devices.json")
	if err != nil {
		// TODO:
		panic(err)
	}

	var mapping map[string]string
	if err != nil {
		// TODO:
		panic(err)
	}
	json.Unmarshal(bytes, &mapping)

	t, ok := mapping[strings.ToUpper(addr)]
	if ok {
		return t
	} else {
		return "_unknown"
	}
}

func parseMeterData(s AdStructure) ([]Record, error) {
	// 温湿度計のパケットの仕様: https://github.com/OpenWonderLabs/SwitchBotAPI-BLE/blob/latest/devicetypes/meter.md#new-broadcast-message

	// 温湿度計のデータはService Data (AdType 22)に入っているので、それ以外は無視
	if s.AdType != 22 {
		return nil, nil
	}

	bytes, err := hex.DecodeString(s.Data)
	if err != nil {
		return nil, err
	}

	// 下記bytesへのインデックスの数字は上記仕様にある Byte: 0 や Byte: 1 の数字とは2つズレている。
	// "The Service data can be 8 bytes max." と記載があるのにテーブルは6byte分しかなく、
	// 適当にズラしてみたら意図通りの数値が得られたためその状態で決め打ちにしておく。
	// その詳細は仕様に記載がないため間違った対応の可能性があるが、ドキュメントされてないもんは仕方ない。
	tempIsNegative := bytes[6]&0b10000000 == 1
	tempInt := int(bytes[6] & 0b01111111)
	tempReal := float32(bytes[5]&0b00001111) / 10
	temperature := float32(tempInt) + tempReal
	if tempIsNegative {
		temperature = -temperature
	}

	battery := float32(bytes[4] & 0b01111111)
	humidity := float32(bytes[7] & 0b01111111)

	return []Record{
		{s.Time, s.DeviceAddress, RecordTypes.Battery, battery},
		{s.Time, s.DeviceAddress, RecordTypes.Temperature, temperature},
		{s.Time, s.DeviceAddress, RecordTypes.Humidity, humidity},
	}, nil
}

func parsePlugData(s AdStructure) ([]Record, error) {
	// プラグミニのパケットの仕様: https://github.com/OpenWonderLabs/SwitchBotAPI-BLE/blob/latest/devicetypes/plugmini.md

	// プラグミニのデータはManufacturer (AdType 255)に入っているので、それ以外は無視
	if s.AdType != 255 {
		return nil, nil
	}

	bytes, err := hex.DecodeString(s.Data)
	if err != nil {
		return nil, err
	}

	var poweron int
	if bytes[9] == 0x80 {
		poweron = 1
	} else {
		poweron = 0
	}

	loadMSB := int(bytes[12] & 0b01111111)
	loadLSB := int(bytes[13])
	load := float32(loadMSB*0xff+loadLSB) / 10

	return []Record{
		{s.Time, s.DeviceAddress, RecordTypes.PowerOn, float32(poweron)},
		{s.Time, s.DeviceAddress, RecordTypes.Load, load},
	}, nil
}

func storeRecord(ctx context.Context, r Record) error {
	// TODO: ちゃんと設定ファイルなり環境変数なりに出す
	bucket := "switchbot-ble"
	org := "switchbot"
	token := os.Getenv("INFLUXDB_TOKEN")
	url := "http://localhost:8086"

	client := influxdb2.NewClient(url, token)
	defer client.Close()

	writeAPI := client.WriteAPIBlocking(org, bucket)
	p := influxdb2.NewPoint(string(r.Type),
		map[string]string{"DeviceId": r.DeviceId},
		map[string]interface{}{"value": r.Value},
		r.Time)
	err := writeAPI.WritePoint(ctx, p)

	return err
}
