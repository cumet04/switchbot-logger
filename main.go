package main

import (
	"bufio"
	"context"
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
	// TODO: なんか属性
}

func processAdStructure(ctx context.Context, s AdStructure) {
	var record *Record

	devType := getDeviceTypeFor(s.DeviceAddress)
	switch devType {
	case "Meter":
		record = parseMeterData(s)
	case "Plug Mini (US)":
		record = parsePlugData(s)
	case "_unknown_":
		return
	default:
		elog.Printf("unexpected device type: %s, addr: %s\n", devType, s.DeviceAddress)
		return
	}

	if record == nil {
		return
	}

	if err := storeRecord(*record); err != nil {
		elog.Printf("failed to store record: %v\n, err: %v", record, err)
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

func parseMeterData(s AdStructure) *Record {
	// TODO: impl
	return nil
}

func parsePlugData(s AdStructure) *Record {
	// TODO: impl
	return nil
}

func storeRecord(r Record) error {
	// TODO: impl
	return nil
}
