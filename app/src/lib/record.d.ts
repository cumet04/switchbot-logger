// レコードのタイムスタンプに使うRFC3339形式の文字列。microsecondまで持つ。
// JavaScriptのDateはmillisecondまでしか持てないこと、このTimeを直接演算する用途はないことから
// stringのまま持つ。
type TimeStr = string & { readonly _brand: unique symbol };

type MacAddress = string & { readonly _brand: unique symbol }; // MACアドレス。現在は小文字
type DeviceId = string & { readonly _brand: unique symbol }; // SwitchBotで管理されるデバイスID。hex大文字
type RecordType =
  | "Battery"
  | "Temperature"
  | "Humidity"
  | "CO2"
  | "PowerOn"
  | "Load";

type SensorRecord = {
  Time: TimeStr;
  DeviceId: MacAddress; // 現時点ではDeviceIdとしてMACアドレスが入っている
  Type: RecordType;
  Value: number;
};

// SwitchBotデバイスのBluetoothメッセージから読みだせるデータレコード
type BluetoothSensorRecord = {
  Time: TimeStr;
  Address: MacAddress;
  Type: RecordType;
  Value: number;
};
