package main

import "testing"

func TestParseLine(t *testing.T) {
	// ターミナル上の見た目としてはこんな感じ
	// xy:96:43:12:61:5b       1       Flags   06      255     Manufacturer    5900ed964312615b        7       Complete 128b Services  cba20d00-224d-11e6-9fb8-0002a5d5c51b    22      16b Service Data        000d540064009b4c
	input := "xy:96:43:12:61:5b\t1\tFlags\t06\t255\tManufacturer\t5900ed964312615b\t7\tComplete 128b Services\tcba20d00-224d-11e6-9fb8-0002a5d5c51b\t22\t16b Service Data\t000d540064009b4c"

	structs, err := parseLine(input)

	if err != nil {
		t.Errorf("want no err, but got: %v", err)
	}

	wants := []AdStructure{
		{
			DeviceAddress: "xy:96:43:12:61:5b",
			AdType:        1,
			Data:          "06",
		},
		{
			DeviceAddress: "xy:96:43:12:61:5b",
			AdType:        255,
			Data:          "5900ed964312615b",
		},
		{
			DeviceAddress: "xy:96:43:12:61:5b",
			AdType:        7,
			Data:          "cba20d00-224d-11e6-9fb8-0002a5d5c51b",
		},
		{
			DeviceAddress: "xy:96:43:12:61:5b",
			AdType:        22,
			Data:          "000d540064009b4c",
		},
	}

	if len(wants) != len(structs) {
		t.Errorf("want %d structs, but got %d structs", len(wants), len(structs))
	}
	for i := range structs {
		if wants[i] != structs[i] {
			t.Errorf("want %v\nbut got %v", wants[i], structs[i])
		}
	}
}

func TestParseMeterData(t *testing.T) {
	records, err := parseMeterData(AdStructure{
		DeviceAddress: "xy:96:43:12:61:5b",
		AdType:        22,
		Data:          "000d540064009b4c",
	})

	if err != nil {
		t.Errorf("want no err, but got: %v", err)
	}

	wants := []Record{
		{
			DeviceId: "xy:96:43:12:61:5b",
			Type:     "Battery",
			Value:    100,
		},
		{
			DeviceId: "xy:96:43:12:61:5b",
			Type:     "Temperature",
			Value:    27.0,
		},
		{
			DeviceId: "xy:96:43:12:61:5b",
			Type:     "Humidity",
			Value:    76,
		},
	}

	if !containExactly(wants, records) {
		t.Errorf("want %v, but got %v", wants, records)
	}
}

func containExactly[T comparable](as []T, bs []T) bool {
	if len(as) != len(bs) {
		return false
	}
	for _, a := range as {
		ok := false
		for _, b := range bs {
			if a == b {
				ok = true
			}
		}
		if ok != false {
			return false
		}
	}
	return true
}
