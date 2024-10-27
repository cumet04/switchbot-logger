import crypto from "crypto";
import { appenv, env } from "./envvars";

type DeviceType =
  | "Plug Mini (US)"
  | "Plug Mini (JP)"
  | "Motion Sensor"
  | "Meter"
  | "WoIOSensor"
  | "Ceiling Light"
  | "Hub Mini";

// 現時点で使う予定のあるステータスのみ定義。infraredRemoteListやhubDeviceIdは無視。
type Device = {
  deviceId: DeviceId;
  deviceName: string;
  deviceType: DeviceType;
};

type DevicesResponse = {
  statusCode: number;
  body: {
    deviceList: Device[];
  };
};

const switchbot = {
  // DeviceTypeにまだ未実装なデバイスを登録した場合は任意のstringが返る
  DeviceTypeFor(
    deviceId: DeviceId
  ): DeviceType | "_NotMyOwnDevice" | (string & {}) {
    if (!this._devicesCache) throw new Error("devices cache is not set");

    // 開発環境では特定IDのみテスト用に受け付ける。E2Eで使う。
    // その場合もあくまでdeviceCacheの検証は行う（switchbotのAPI疎通は行う）とする
    if (appenv() !== "production" && deviceId === "ACDE4828ACED")
      return "Meter";

    const devices = this._devicesCache.body.deviceList;
    const device = devices.find((d) => d.deviceId === deviceId);
    if (!device) return "_NotMyOwnDevice";

    return device.deviceType;
  },

  DeviceNameFor(deviceId: DeviceId): string | null {
    if (!this._devicesCache) throw new Error("devices cache is not set");

    const devices = this._devicesCache.body.deviceList;
    const device = devices.find((d) => d.deviceId === deviceId);
    if (!device) return null;

    return device.deviceName;
  },

  DevicesFor(type: DeviceType): Device[] {
    if (!this._devicesCache) throw new Error("devices cache is not set");

    return this._devicesCache.body.deviceList.filter(
      (d) => d.deviceType === type
    );
  },

  // Devices利用メソッドを呼ぶ前にこれを呼んでおく。
  // 利用メソッド内から直接呼ばないようにすることでasync汚染を局所化する。
  async EnsureDevices(force = false): Promise<DevicesResponse> {
    if (force || !this._devicesCache) {
      const endpoint = "https://api.switch-bot.com/v1.1/devices";
      const resp = await this.switchbotGet(endpoint);

      if (resp.status !== 200) {
        throw new Error(`unexpected status code: ${resp.status.toString()}`);
      }

      // TODO: DeviceTypesにないものが渡ってきた場合に、warnログを吐きつつ無視するようにする
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      this._devicesCache = (await resp.json()) as DevicesResponse;
    }
    return this._devicesCache;
  },
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  _devicesCache: null as DevicesResponse | null,

  async switchbotGet(url: string) {
    const token = env("SWITCHBOT_TOKEN");
    const secret = env("SWITCHBOT_SECRET");
    if (!token || !secret) throw new Error("token or secret is not set");

    // https://github.com/OpenWonderLabs/SwitchBotAPI/blob/21f905ba96147028d85517b517beef3a2d66bb50/README.md#authentication

    const nonce = crypto.randomUUID();
    const t = Date.now().toString();

    const data = token + t + nonce;
    const signTerm = crypto
      .createHmac("sha256", secret)
      .update(Buffer.from(data, "utf-8"))
      .digest();
    const sign = signTerm.toString("base64");

    return await fetch(url, {
      method: "GET",
      headers: {
        Authorization: token,
        sign,
        nonce,
        t,
      },
    });
  },
};

// テスト用にダミーのデバイスリストをセット
export function SetDummyDevicesCache(devices: Device[]) {
  switchbot._devicesCache = {
    statusCode: 200,
    body: {
      deviceList: devices,
    },
  };
}

const exportSwitchbot: Pick<
  typeof switchbot,
  "DeviceTypeFor" | "DeviceNameFor" | "DevicesFor" | "EnsureDevices"
> = switchbot;
export default exportSwitchbot;
