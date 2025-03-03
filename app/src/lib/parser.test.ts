import { SetDummyDevicesCache } from "./switchbot";
import { MacAddress, MacToId, Parse, TimeStr } from "./parser";

const meterMac = MacAddress("ac:de:48:28:ac:ed");
const woioSensorMac = MacAddress("ac:de:48:01:d3:95");
const meterProCo2Mac = MacAddress("ac:de:48:8a:df:54");
const plugUsMac = MacAddress("ac:de:48:6c:5f:f0");
const plugJpMac = MacAddress("ac:de:48:4b:5e:d3");

describe("parse", () => {
  SetDummyDevicesCache([
    {
      deviceId: MacToId(meterMac),
      deviceType: "Meter",
      deviceName: "デスク上",
    },
    {
      deviceId: MacToId(woioSensorMac),
      deviceType: "WoIOSensor",
      deviceName: "ベランダ上",
    },
    {
      deviceId: MacToId(plugUsMac),
      deviceType: "Plug Mini (US)",
      deviceName: "サーキュレーター",
    },
    {
      deviceId: MacToId(plugJpMac),
      deviceType: "Plug Mini (JP)",
      deviceName: "サーキュレーター",
    },
    {
      deviceId: MacToId(meterProCo2Mac),
      deviceType: "MeterPro(CO2)",
      deviceName: "CO2センサー",
    },
  ]);

  describe("汎用ケース", () => {
    it("TimeとAddressは入力と同じ値が返る", () => {
      const time1 = "2023-09-27T07:38:44.951123+00:00";
      const addr1 = meterMac;
      const input1 = {
        time: time1,
        addr: addr1,
        structs: [
          // 中身はなんでもよいので、Meterでパース可能な値を入れておく
          { adtype: 22, desc: "16b Service Data", value: "000d540064009b4c" },
          {
            adtype: 255,
            desc: "Manufacturer",
            value: "6909e02b7e6b4f4a610300994600",
          },
        ],
      };
      Parse(JSON.stringify(input1)).forEach((r) => {
        expect(r.Time).toBe(time1);
        expect(r.Address).toBe(addr1);
      });

      const time2 = "2023-09-30T13:05:48.027472+00:00";
      const addr2 = plugUsMac;
      const input2 = {
        time: time2,
        addr: addr2,
        structs: [
          // 中身はなんでもよいので、Plug Mini (US)でパース可能な値を入れておく
          {
            adtype: 255,
            desc: "Manufacturer",
            value: "69096055f93599ff048010260a8f",
          },
        ],
      };
      Parse(JSON.stringify(input2)).forEach((r) => {
        expect(r.Time).toBe(time2);
        expect(r.Address).toBe(addr2);
      });
    });

    // raspi側のプログラムが稀にマイクロ秒なしのフォーマットのデータを生成することがある
    it("Timeはマイクロ秒無しも許容される", () => {
      const time = "2023-09-30T13:05:48+00:00";
      const addr = plugUsMac;
      const input = {
        time,
        addr,
        structs: [
          // 中身はなんでもよいので、Plug Mini (US)でパース可能な値を入れておく
          {
            adtype: 255,
            desc: "Manufacturer",
            value: "69096055f93599ff048010260a8f",
          },
        ],
      };
      Parse(JSON.stringify(input)).forEach((r) => {
        expect(r.Time).toBe(time);
      });
    });

    it("不正なJSONデータを入力した場合、JSONパースエラーになる", () => {
      const input = "xxx";
      expect(() => Parse(input)).toThrow(
        /Unexpected token .*, .* is not valid JSON/
      );
    });

    it("登録されていないMACアドレスを入力した場合、空配列が返る", () => {
      const input = {
        time: "2023-09-27T07:38:44.951123+00:00",
        addr: "ac:de:48:ff:ff:ff",
        structs: [
          { adtype: 22, desc: "16b Service Data", value: "000d540064009b4c" },
        ],
      };
      const actual = Parse(JSON.stringify(input));
      expect(actual).toEqual([]);
    });
  });
});

describe("センサー種類ごと", () => {
  const parseMatch = (
    addr: MacAddress,
    input: string,
    want: Pick<BluetoothSensorRecord, "Type" | "Value">[]
  ) => {
    const Time = TimeStr("2022-08-29T14:35:36.033219+00:00");
    const inputJson = `{"time": "${Time}", "addr": "${addr}", "structs": [${input}]}`;
    expect(Parse(inputJson)).toEqual(
      want.map((w) => ({
        Time,
        Address: addr,
        ...w,
      }))
    );
  };

  describe("Meter Data", () => {
    it("AdTypeが22(Service Data)の場合は各種情報が返る", () => {
      parseMatch(
        meterMac,
        '{"adtype": 22, "desc": "16b Service Data", "value": "000d540064009b4c"}',
        [
          { Type: "Battery", Value: 100 },
          { Type: "Temperature", Value: 27.0 },
          { Type: "Humidity", Value: 76 },
        ]
      );
    });
    it("気温が氷点下の場合", () => {
      parseMatch(
        meterMac,
        '{"adtype": 22, "desc": "16b Service Data", "value": "000d540064051b4c"}',
        [
          { Type: "Battery", Value: 100 },
          { Type: "Temperature", Value: -27.5 },
          { Type: "Humidity", Value: 76 },
        ]
      );
    });
    // AdTypeが22以外の場合は情報をとらない
    it("AdTypeが1(Flags)の場合は空配列", () => {
      parseMatch(meterMac, '{"adtype": 1, "desc": "Flags", "value": "06"}', []);
    });
    it("AdTypeが255(Manufacturer)の場合は空配列", () => {
      parseMatch(
        meterMac,
        '{"adtype": 255, "desc": "Manufacturer", "value": "1"}',
        []
      );
    });
  });

  describe("WoIOSensor Data", () => {
    it("AdTypeが22(Service Data)の場合はバッテリー情報が返る", () => {
      parseMatch(
        woioSensorMac,
        '{"adtype": 22, "desc": "16b Service Data", "value": "3dfd770045"}',
        [{ Type: "Battery", Value: 69 }]
      );
    });
    it("AdTypeが255(Manufacturer)の場合は各種情報が返る", () => {
      parseMatch(
        woioSensorMac,
        '{"adtype": 255, "desc": "Manufacturer", "value": "6909e02b7e6b4f4a610300994600"}',
        [
          { Type: "Temperature", Value: 25.0 },
          { Type: "Humidity", Value: 70 },
        ]
      );
    });
  });

  describe("MeterPro(CO2) Data", () => {
    it("AdTypeが22(Service Data)の場合はバッテリー情報が返る", () => {
      parseMatch(
        meterProCo2Mac,
        '{"adtype": 22, "desc": "16b Service Data", "value": "3dfd350064"}',
        [{ Type: "Battery", Value: 100 }]
      );
    });
    it("AdTypeが255(Manufacturer)の場合は各種情報が返る", () => {
      parseMatch(
        meterProCo2Mac,
        '{"adtype": 255, "desc": "Manufacturer", "value": "6909b0e9fe548adf91e400983e002502a700"}',
        [
          { Type: "Temperature", Value: 24.0 },
          { Type: "Humidity", Value: 62 },
          { Type: "CO2", Value: 679 },
        ]
      );
    });
  });

  describe("Plug Mini (US) Data", () => {
    it("AdTypeが255(Manufacturer)の場合は各種情報が返る", () => {
      parseMatch(
        plugUsMac,
        '{"adtype": 255, "desc": "Manufacturer", "value": "69096055f93599ff048010260a8f"}',
        [
          { Type: "PowerOn", Value: 1 },
          { Type: "Load", Value: 269.3 },
        ]
      );
    });

    it("電源OFFの場合", () => {
      parseMatch(
        plugUsMac,
        '{"adtype": 255, "desc": "Manufacturer", "value": "69096055f93599ff040010260000"}',
        [
          { Type: "PowerOn", Value: 0 },
          { Type: "Load", Value: 0 },
        ]
      );
    });

    // AdTypeが255(Manufacturer)以外であれば空配列
    it("AdTypeが1(Flags)の場合は空配列", () => {
      parseMatch(
        plugUsMac,
        '{"adtype": 1, "desc": "Flags", "value": "06"}',
        []
      );
    });
  });

  describe("Plug Mini (JP) Data", () => {
    // USと同じなので、簡易に1ケースだけテストしておく
    it("AdTypeが255(Manufacturer)の場合は各種情報が返る", () => {
      parseMatch(
        plugJpMac,
        '{"adtype": 255, "desc": "Manufacturer", "value": "69096055f93599ff048010260a8f"}',
        [
          { Type: "PowerOn", Value: 1 },
          { Type: "Load", Value: 269.3 },
        ]
      );
    });
  });
});
