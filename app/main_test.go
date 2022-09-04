package main

import (
	"testing"
	"time"
)

func Test_parseMessage(t *testing.T) {
	cases := map[string]struct {
		Input string
		Want  []AdStructure
	}{
		"サンプル1": {
			Input: `{"time": "2022-08-29T14:34:54.335280+00:00", "addr": "xy:42:2c:f1:18:gg", "structs": [
				{"adtype": 255, "desc": "Manufacturer", "value": "06000109200287f865421e4d6b91bbabb73cf4d4a328d79d4233625ce8"}
			]}`,
			Want: []AdStructure{
				{time.Date(2022, 8, 29, 14, 34, 54, 335280*1000, time.UTC), "xy:42:2c:f1:18:gg", 255, "06000109200287f865421e4d6b91bbabb73cf4d4a328d79d4233625ce8"},
			},
		},
		"サンプル2": {
			Input: `{"time": "2022-08-29T14:35:36.033219+00:00", "addr": "vv:27:f9:13:70:px", "structs": [
				{"adtype": 3, "desc": "Complete 16b Services", "value": "0000fe9f-0000-1000-8000-00805f9b34fb"},
				{"adtype": 22, "desc": "16b Service Data", "value": "9ffe0000000000000000000000000000000000000000"},
				{"adtype": 255, "desc": "Manufacturer", "value": "e000001fca60fa8a"}
			]}`,
			Want: []AdStructure{
				{time.Date(2022, 8, 29, 14, 35, 36, 33219*1000, time.UTC), "vv:27:f9:13:70:px", 3, "0000fe9f-0000-1000-8000-00805f9b34fb"},
				{time.Date(2022, 8, 29, 14, 35, 36, 33219*1000, time.UTC), "vv:27:f9:13:70:px", 22, "9ffe0000000000000000000000000000000000000000"},
				{time.Date(2022, 8, 29, 14, 35, 36, 33219*1000, time.UTC), "vv:27:f9:13:70:px", 255, "e000001fca60fa8a"},
			},
		},
	}

	for name, c := range cases {
		structs, err := parseMessage(c.Input)
		if err != nil {
			t.Errorf("Case %s failed: want no err, but got: %v", name, err)
		}
		if !containExactly(c.Want, structs) {
			t.Errorf("Case %s failed:\nwant %v,\ngot %v", name, c.Want, structs)
		}
	}
}

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
