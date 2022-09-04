package main

import (
	"testing"
	"time"
)

func Test_parseMeterData(t *testing.T) {
	now := time.Now()
	cases := map[string]struct {
		Input AdStructure
		Want  []Record
	}{
		"AdTypeが22(Service Data)の場合は各種情報が返る": {
			Input: AdStructure{now, "xy:96:43:12:61:5b", 22, "000d540064009b4c"},
			Want: []Record{
				{now, "xy:96:43:12:61:5b", "Battery", 100},
				{now, "xy:96:43:12:61:5b", "Temperature", 27.0},
				{now, "xy:96:43:12:61:5b", "Humidity", 76},
			},
		},
		"気温が氷点下の場合": {
			Input: AdStructure{now, "xy:96:43:12:71:5b", 22, "000d540064001b4c"},
			Want: []Record{
				{now, "xy:96:43:12:71:5b", "Battery", 100},
				{now, "xy:96:43:12:71:5b", "Temperature", -27.0},
				{now, "xy:96:43:12:71:5b", "Humidity", 76},
			},
		},
		// AdTypeが22(Service Data)以外であればnil
		"AdTypeが1(Flags)の場合はnil": {
			Input: AdStructure{now, "xy:96:43:12:81:5b", 1, "06"},
			Want:  nil,
		},
		"AdTypeが255(Manufacturer)の場合はnil": {
			Input: AdStructure{now, "xy:96:43:12:91:5b", 255, "1"},
			Want:  nil,
		},
	}

	for name, c := range cases {
		records, err := parseMeterData(c.Input)
		if err != nil {
			t.Errorf("Case %s failed: want no err, but got: %v", name, err)
		}
		if !containExactly(c.Want, records) {
			t.Errorf("Case %s failed:\nwant %v,\ngot %v", name, c.Want, records)
		}
	}
}

func Test_parsePlugData(t *testing.T) {
	now := time.Now()
	cases := map[string]struct {
		Input AdStructure
		Want  []Record
	}{
		"AdTypeが255(Manufacturer)の場合は各種情報が返る": {
			// DataにAddressが含まれるためxyでマスクするとhex.Decodeが失敗する。
			// そのためMACアドレスはffでマスクする
			Input: AdStructure{now, "60:55:f9:35:99:ff", 255, "69096055f93599ff048010260a8f"},
			Want: []Record{
				{now, "60:55:f9:35:99:ff", "PowerOn", 1},
				{now, "60:55:f9:35:99:ff", "Load", 269.3},
			},
		},
		"電源OFFの場合": {
			Input: AdStructure{now, "60:55:f9:35:89:ff", 255, "69096055f93599ff040010260000"},
			Want: []Record{
				{now, "60:55:f9:35:89:ff", "PowerOn", 0},
				{now, "60:55:f9:35:89:ff", "Load", 0},
			},
		},
		// AdTypeが255(Manufacturer)以外であればnil
		"AdTypeが1(Flags)の場合はnil": {
			Input: AdStructure{now, "60:55:f9:35:79:ff", 1, "06"},
			Want:  nil,
		},
	}

	for name, c := range cases {
		records, err := parsePlugData(c.Input)
		if err != nil {
			t.Errorf("Case %s failed: want no err, but got: %v", name, err)
		}
		if !containExactly(c.Want, records) {
			t.Errorf("Case %s failed:\nwant %v,\ngot %v", name, c.Want, records)
		}
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
