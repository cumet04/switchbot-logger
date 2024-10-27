import assert from "node:assert/strict";
import switchbot from "./switchbot";

// MEMO: bluetoothのセンサレコードのparseと固有型のヘルパー関数が同じファイルにあるのはおかしいのでそのうち直したい

type AdStructure = {
  Time: TimeStr;
  DeviceAddress: MacAddress;
  AdType: number;
  Data: string;
};

export function Parse(msg: string): BluetoothSensorRecord[] {
  const structs = extractAdStructures(msg);

  return structs.flatMap((s) => {
    const type = switchbot.DeviceTypeFor(MacToId(s.DeviceAddress));
    switch (type) {
      case "Meter":
        return parseMeterData(s);
      case "WoIOSensor":
        return parseWoIOSensorData(s);
      case "Plug Mini (US)":
      case "Plug Mini (JP)":
        return parsePlugData(s);
      case "Motion Sensor": // TODO: impl; https://github.com/OpenWonderLabs/SwitchBotAPI-BLE/blob/5351dff1c78f6c7e2191cb0e37b9df080266ae77/devicetypes/motionsensor.md
      case "Ceiling Light": // 公式仕様書にまだ記載がない
      case "Hub Mini": // Hub Miniの情報はいらないので無視
      case "_NotMyOwnDevice":
        return [];
      default:
        return [];
    }
  });
}

function extractAdStructures(msg: string): AdStructure[] {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const input = JSON.parse(msg) as {
    time: string;
    addr: string;
    structs: {
      adtype: number;
      desc: string;
      value: string;
    }[];
  };
  const Time = TimeStr(input.time);
  const DeviceAddress = MacAddress(input.addr);
  return input.structs.map((s) => ({
    Time,
    DeviceAddress,
    AdType: s.adtype,
    Data: s.value,
  }));
}

function parseMeterData(s: AdStructure): BluetoothSensorRecord[] {
  // 温湿度計のパケットの仕様: https://github.com/OpenWonderLabs/SwitchBotAPI-BLE/blob/5351dff1c78f6c7e2191cb0e37b9df080266ae77/devicetypes/meter.md#new-broadcast-message

  // 温湿度計のデータはService Data (AdType 22)に入っているので、それ以外は無視
  if (s.AdType !== 22) return [];

  // 先頭2バイトはデバイスごとに同じなので捨てる。仕様の表のインデックスはこの前提で記載されている
  const bytes = Buffer.from(s.Data, "hex").subarray(2);

  const tempIsNegative = !(bytes[4] & 0b10000000);
  const tempInt = bytes[4] & 0b01111111;
  const tempReal = (bytes[3] & 0b00001111) / 10;
  const temperature = tempInt + tempReal;

  const battery = bytes[2] & 0b01111111;
  const humidity = bytes[5] & 0b01111111;

  return [
    {
      Time: s.Time,
      Address: s.DeviceAddress,
      Type: "Battery",
      Value: battery,
    },
    {
      Time: s.Time,
      Address: s.DeviceAddress,
      Type: "Temperature",
      Value: tempIsNegative ? -temperature : temperature,
    },
    {
      Time: s.Time,
      Address: s.DeviceAddress,
      Type: "Humidity",
      Value: humidity,
    },
  ];
}
function parseWoIOSensorData(s: AdStructure): BluetoothSensorRecord[] {
  // 公式仕様書に記載がないので、個人ブログを参照 https://tsuzureya.net/?p=812

  // 主なデータは Manufacturer(255)にあるので、それ以外は無視。
  // 参考ブログのコメント欄より、ServiceData(22)にバッテリ残量がありそうなことが書かれているが
  // バッテリ残量が減らなすぎて検証できない。バッテリが減りそうになったらまた考える
  if (s.AdType !== 255) return [];

  const bytes = Buffer.from(s.Data, "hex");

  const tempIsNegative = !(bytes[11] & 0b10000000);
  const tempInt = bytes[11] & 0b01111111;
  const tempReal = (bytes[10] & 0b00001111) / 10;
  const temperature = tempInt + tempReal;

  const humidity = bytes[12] & 0b01111111;

  return [
    {
      Time: s.Time,
      Address: s.DeviceAddress,
      Type: "Temperature",
      Value: tempIsNegative ? -temperature : temperature,
    },
    {
      Time: s.Time,
      Address: s.DeviceAddress,
      Type: "Humidity",
      Value: humidity,
    },
  ];
}
function parsePlugData(s: AdStructure): BluetoothSensorRecord[] {
  // プラグミニのパケットの仕様: https://github.com/OpenWonderLabs/SwitchBotAPI-BLE/blob/5351dff1c78f6c7e2191cb0e37b9df080266ae77/devicetypes/plugmini.md

  if (s.AdType !== 255) return []; // プラグミニのデータはManufacturer(255)に入っているので、それ以外は無視

  const bytes = Buffer.from(s.Data, "hex");

  const powerOn = bytes[9] === 0x80 ? 1 : 0;

  const loadMSB = bytes[12] & 0b01111111;
  const loadLSB = bytes[13];
  const load = (loadMSB * 0xff + loadLSB) / 10;

  return [
    {
      Time: s.Time,
      Address: s.DeviceAddress,
      Type: "PowerOn",
      Value: powerOn,
    },
    {
      Time: s.Time,
      Address: s.DeviceAddress,
      Type: "Load",
      Value: load,
    },
  ];
}

/* eslint-disable @typescript-eslint/consistent-type-assertions */
export function MacAddress(addr: string): MacAddress {
  assert.match(addr, /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/);
  return addr as MacAddress;
}

export function DeviceId(addr: string): DeviceId {
  assert.match(addr, /^[0-9A-F]{12}$/);
  return addr as DeviceId;
}

export function TimeStr(time: string): TimeStr {
  // いまのところタイムゾーンは+00:00しか来ないので、それで固定
  // マイクロ秒はこないこともあるので、それも考慮
  assert.match(
    time,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{6}){0,1}\+00:00$/
  );
  return time as TimeStr;
}
/* eslint-enable @typescript-eslint/consistent-type-assertions */

export function MacToId(mac: MacAddress): DeviceId {
  return DeviceId(mac.replace(/:/g, "").toUpperCase());
}

export function IdToMac(id: DeviceId): MacAddress {
  const l = id.toLowerCase();
  return MacAddress(
    [
      l.substring(0, 2),
      l.substring(2, 4),
      l.substring(4, 6),
      l.substring(6, 8),
      l.substring(8, 10),
      l.substring(10, 12),
    ].join(":")
  );
}
