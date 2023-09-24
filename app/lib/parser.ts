import switchbot from "./switchbot";

// SwitchBotデバイスのBluetoothメッセージから読みだせるデータレコード
type BluetoothSensorRecord = {
  Time: Date;
  Address: MacAddress;
  Type: DeviceType;
  Value: number;
};

export function Parse(msg: string): BluetoothSensorRecord[] {
  console.log(switchbot.DeviceTypeFor(msg as DeviceId)); // TEST
  return [];
}
