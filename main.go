package main

import (
	"bufio"
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
)

var elog = log.New(os.Stderr, "", log.LstdFlags)

func main() {
	var wg sync.WaitGroup
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	scan := bufio.NewScanner(os.Stdin)
	for scan.Scan() {
		line := scan.Text()

		structs, err := parseLine(line)
		if err != nil {
			elog.Printf("failed to parse line; %s", err)
			elog.Printf("  given line: %s", line)
			continue
		}

		for _, s := range structs {
			wg.Add(1)
			go func(s AdStructure) {
				defer wg.Done()
				processAdStructure(ctx, s)
			}(s)
		}
	}

	if scan.Err() != nil {
		log.Fatal(scan.Err())
	}

	wg.Wait()
}

type AdStructure struct {
	DeviceAddress string
	AdType        int
	Data          string
}

func parseLine(line string) ([]AdStructure, error) {
	tokens := strings.Split(line, "\t")

	if len(tokens) == 0 {
		return nil, fmt.Errorf("given input has no tokens")
	}
	addr := tokens[0]

	// FIXME: "3stringごと"みたいなところもうちょいいい感じに書けないか
	rest := tokens[1:]
	if len(rest)%3 != 0 {
		return nil, fmt.Errorf("invalid token count")
	}

	var ads []AdStructure
	for ; len(rest) > 0; rest = rest[3:] {
		rawAdType := rest[0]
		// rest[1] はdescriptionだが、利用しないため読み取らずここで捨てる。refs scanner.py
		rawData := rest[2]

		t, err := strconv.Atoi(rawAdType)
		if err != nil {
			return nil, fmt.Errorf("given AdType isn't number: adtype=%s", rawAdType)
		}
		ads = append(ads, AdStructure{
			DeviceAddress: addr,
			AdType:        t,
			Data:          rawData,
		})
	}

	return ads, nil
}

type Record struct {
	DeviceId string
	Type     string
	Value    float32
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
		if err := storeRecord(r); err != nil {
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
		{
			DeviceId: s.DeviceAddress,
			Type:     "Battery",
			Value:    battery,
		},
		{
			DeviceId: s.DeviceAddress,
			Type:     "Temperature",
			Value:    temperature,
		},
		{
			DeviceId: s.DeviceAddress,
			Type:     "Humidity",
			Value:    humidity,
		},
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

	loadMSB := bytes[12] & 0b01111111
	loadLSB := bytes[13]
	load := float32(loadMSB*0xff+loadLSB) / 10

	return []Record{
		{
			DeviceId: s.DeviceAddress,
			Type:     "PowerOn",
			Value:    float32(poweron),
		},
		{
			DeviceId: s.DeviceAddress,
			Type:     "Load",
			Value:    load,
		},
	}, nil
}

func storeRecord(r Record) error {
	// TODO: impl
	return nil
}
