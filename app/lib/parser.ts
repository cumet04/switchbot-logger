import switchbot from "./switchbot";

export function Parse(msg: string): BluetoothSensorRecord[] {
  console.log(switchbot.DeviceTypeFor(DeviceId(msg))); // TEST
  return [];
}

// MEMO: 関数内で値のチェックをしてもいいと思う
/* eslint-disable @typescript-eslint/consistent-type-assertions */
export function MacAddress(addr: string): MacAddress {
  return addr as MacAddress;
}

export function DeviceId(addr: string): DeviceId {
  return addr as DeviceId;
}

export function TimeStr(time: string): TimeStr {
  return time as TimeStr;
}
/* eslint-enable @typescript-eslint/consistent-type-assertions */
