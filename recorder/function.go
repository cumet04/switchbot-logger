package recorder

import (
	"bufio"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/GoogleCloudPlatform/functions-framework-go/functions"
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

func init() {
	functions.HTTP("HandleFunc", HandleFunc)
}

func HandleFunc(w http.ResponseWriter, r *http.Request) {
	err := entrypoint(r)
	if err != nil {
		log.Println(err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
}

func entrypoint(r *http.Request) error {
	var records []Record

	scanner := bufio.NewScanner(r.Body)
	for scanner.Scan() {
		line := scanner.Text()
		r, err := parseMessage(line)
		if err != nil {
			return err
		}
		records = append(records, r...)
	}

	for _, r := range records {
		// TODO: bqに投げる
		fmt.Printf("%v\n", r)
	}
	return nil
}

func parseMessage(msg string) ([]Record, error) {
	// msg has-many AdStructures
	// AdStructure has-many Records

	structs, err := extractAdStructures(msg)
	if err != nil {
		return nil, fmt.Errorf("parse message failed: %v", err)
	}

	var records []Record
	for _, s := range structs {
		items, err := extractRecords(s)
		if err != nil {
			return nil, fmt.Errorf("failed to extract records, err=%v, ad structure=%v", err, s)
		}
		records = append(records, items...)
	}

	return records, nil
}

func extractAdStructures(msg string) ([]AdStructure, error) {
	var signal struct {
		Time    string `json:"time"`
		Addr    string `json:"addr"`
		Structs []struct {
			AdType int    `json:"adtype"`
			Desc   string `json:"desc"`
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
		structs = append(structs, AdStructure{t.UTC(), signal.Addr, s.AdType, s.Value})
	}
	return structs, nil
}

var extractRecords_mapping map[string]string

func extractRecords(s AdStructure) ([]Record, error) {
	if extractRecords_mapping == nil {
		bytes, err := os.ReadFile("./devices.json")
		if err != nil {
			// TODO:
			panic(err)
		}

		err = json.Unmarshal(bytes, &extractRecords_mapping)
		if err != nil {
			// TODO:
			panic(err)
		}
	}

	devType, ok := extractRecords_mapping[strings.ToUpper(s.DeviceAddress)]
	if !ok {
		devType = "_unknown_"
	}

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
