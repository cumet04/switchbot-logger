package main

import "testing"

func Test_parseMeterDataはServiceData以外のStructureにはnilを返す(t *testing.T) {
	inputs := []AdStructure{
		// 適当にいくつかリアルっぽいデータを用意
		{DeviceAddress: "xy:96:43:12:61:5b", AdType: 1, Data: "06"},
		{DeviceAddress: "xy:96:43:12:61:5b", AdType: 255, Data: "1"},
	}

	for _, input := range inputs {
		records, err := parseMeterData(input)

		if err != nil {
			t.Errorf("want no err, but got: %v, input: %v", err, input)
		}

		if records != nil {
			t.Errorf("want nil, but got: %v, input: %v", err, records)
		}
	}
}

func Test_parsePlugData(t *testing.T) {
	records, err := parsePlugData(AdStructure{
		DeviceAddress: "60:55:f9:35:99:ff", // DataにAddressが含まれるためxyでマスクするとhex.Decodeが失敗するのでffでマスク
		AdType:        255,
		Data:          "69096055f9360baa048010260a8f",
	})

	if err != nil {
		t.Errorf("want no err, but got: %v", err)
	}

	wants := []Record{
		{
			DeviceId: "60:55:f9:35:99:ff",
			Type:     "PowerOn",
			Value:    1,
		},
		{
			DeviceId: "60:55:f9:35:99:ff",
			Type:     "Load",
			Value:    269.3,
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
		if ok == false {
			return false
		}
	}
	return true
}
