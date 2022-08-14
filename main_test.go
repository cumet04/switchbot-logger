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

	if len(structs) != 4 {
		t.Errorf("want 4 elements, but got %d", len(structs))
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
	for i := range structs {
		if wants[i] != structs[i] {
			t.Errorf("want %v\nbut got %v", wants[i], structs[i])
		}
	}
}
