import assert from "node:assert/strict";
import switchbot from "./switchbot";

export function Parse(msg: string): BluetoothSensorRecord[] {
  console.log(switchbot.DeviceTypeFor(DeviceId(msg))); // TEST
  return [];
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
  assert.match(time, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}\+00:00$/);
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
