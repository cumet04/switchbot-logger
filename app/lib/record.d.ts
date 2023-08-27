type MacAddress = string & { readonly _brand: unique symbol }; // MACアドレス。現在は小文字
type DeviceId = string & { readonly _brand: unique symbol }; // SwitchBotで管理されるデバイスID。hex大文字
type DeviceType = "Battery" | "Temperature" | "Humidity" | "PowerOn" | "Load";

type SensorRecord = {
  Time: Date;
  DeviceId: MacAddress; // 現時点ではDeviceIdとしてMACアドレスが入っている
  Type: DeviceType;
  Value: number;
};
