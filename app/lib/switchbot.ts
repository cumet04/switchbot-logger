import crypto from "crypto";
import { env } from "./envvars";

export const DeviceTypes = [
  "Plug Mini (US)",
  "Plug Mini (JP)",
  "Motion Sensor",
  "Meter",
  "WoIOSensor",
  "Ceiling Light",
  "Hub Mini",
] as const;
type DeviceType = (typeof DeviceTypes)[number];

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
  // 利用側でSetCredentialsみたいな感じで入れてもよいが、ひとまずload時点で環境変数を読むようにしておく
  _token: env("switchbotToken"),
  _secret: env("switchbotSecret"),

  DeviceTypeFor(deviceId: DeviceId): DeviceType | null {
    if (!this._devicesCache) throw new Error("devices cache is not set");

    const devices = this._devicesCache.body.deviceList;
    const device = devices.find((d) => d.deviceId === deviceId);
    if (!device) return null;

    return device.deviceType;
  },

  // Devices利用メソッドを呼ぶ前にこれを読んでおく。
  // 利用メソッド内から直接呼ばないようにすることでasync汚染を局所化する。
  async EnsureDevices(force = false): Promise<DevicesResponse> {
    if (force || !this._devicesCache) {
      const endpoint = "https://api.switch-bot.com/v1.1/devices";
      const resp = await this.switchbotGet(endpoint);

      if (resp.status !== 200) {
        throw new Error(`unexpected status code: ${resp.status}`);
      }

      // TODO: DeviceTypesにないものが渡ってきた場合に、warnログを履きつつ無視するようにする
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      this._devicesCache = (await resp.json()) as DevicesResponse;
    }
    return this._devicesCache;
  },
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  _devicesCache: null as DevicesResponse | null,

  async switchbotGet(url: string) {
    const token = this._token;
    const secret = this._secret;
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
  "DeviceTypeFor" | "EnsureDevices"
> = switchbot;
export default exportSwitchbot;
