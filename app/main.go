package main

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
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

func main() {
	elog := log.New(os.Stderr, "", log.LstdFlags)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	cStructs := make(chan AdStructure, 10)

	go func() {
		defer close(cStructs)

		ch := subscribe(ctx, "localhost:6379", "switchbot")
		for msg := range ch {
			structs, err := parseMessage(msg)
			if err != nil {
				elog.Printf("parse message failed: %v\n", err)
			}

			for _, s := range structs {
				cStructs <- s
			}
		}
	}()

	var recorder Recorder
	if len(os.Getenv("INFLUXDB_URL")) > 0 {
		recorder = NewInfluxRecorder(
			os.Getenv("INFLUXDB_URL"),
			os.Getenv("INFLUXDB_TOKEN"),
			os.Getenv("INFLUXDB_ORG"),
			os.Getenv("INFLUXDB_BUCKET"),
		)
	} else {
		recorder = NewStdoutRecorder()
	}

	for s := range cStructs {
		records, err := extractRecords(ctx, s)
		if err != nil {
			elog.Printf("failed to extract records, err=%v, ad structure=%v\n", err, s)
		}
		for _, r := range records {
			recorder.Record(ctx, r)
		}
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

func parseMessage(msg string) ([]AdStructure, error) {
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
		return nil, err
	}

	t, err := time.Parse(time.RFC3339Nano, signal.Time)
	if err != nil {
		return nil, err
	}

	var structs []AdStructure
	for _, s := range signal.Structs {
		structs = append(structs, AdStructure{t, signal.Addr, s.AdType, s.Value})
	}
	return structs, nil
}

func extractRecords(ctx context.Context, s AdStructure) ([]Record, error) {
	devType := getDeviceTypeFor(s.DeviceAddress)
	switch devType {
	case "Meter":
		return parseMeterData(s)
	case "Plug Mini (US)":
		return parsePlugData(s)
	case "_unknown_":
		return nil, nil
	default:
		return nil, fmt.Errorf("unexpected device type: %s, addr: %s", devType, s.DeviceAddress)
	}
}

func getDeviceTypeFor(addr string) string {
	bytes, err := os.ReadFile("devices.json")
	if err != nil {
		// TODO:
		panic(err)
	}

	var mapping map[string]string
	err = json.Unmarshal(bytes, &mapping)
	if err != nil {
		// TODO:
		panic(err)
	}

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
	tempIsNegative := bytes[6]&0b10000000 == 0
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

type Recorder interface {
	Record(ctx context.Context, r Record) error
	Close()
}

type InfluxRecorder struct {
	client influxdb2.Client
	org    string
	bucket string
}

func NewInfluxRecorder(url string, token string, org string, bucket string) *InfluxRecorder {
	return &InfluxRecorder{
		client: influxdb2.NewClient(url, token),
		org:    org,
		bucket: bucket,
	}
}

func (r *InfluxRecorder) Record(ctx context.Context, record Record) error {
	writeAPI := r.client.WriteAPIBlocking(r.org, r.bucket)
	p := influxdb2.NewPoint(
		string(record.Type),
		map[string]string{"DeviceId": record.DeviceId},
		map[string]interface{}{"value": record.Value},
		record.Time,
	)

	return writeAPI.WritePoint(ctx, p)
}

func (r *InfluxRecorder) Close() {
	r.client.Close()
}

type StdoutRecorder struct{}

func NewStdoutRecorder() *StdoutRecorder {
	return &StdoutRecorder{}
}

func (r *StdoutRecorder) Record(ctx context.Context, record Record) error {
	fmt.Println(record)
	return nil
}

func (r *StdoutRecorder) Close() {
	// nop
}
