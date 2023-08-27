import crypto from "crypto";
import { env } from "./envvars";

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

  async DeviceTypeFor(deviceId: DeviceId): Promise<DeviceType> {
    const devices = (await this.FetchDevices()).body.deviceList;
    const device = devices.find((d) => d.deviceId === deviceId);
    if (!device) {
      throw new Error(`device not found: ${deviceId}`);
    }
    return device.deviceType;
  },

  _devicesCache: null as DevicesResponse | null,
  async FetchDevices(force = false): Promise<DevicesResponse> {
    if (force || !this._devicesCache) {
      const endpoint = "https://api.switch-bot.com/v1.1/devices";
      const resp = await this.switchbotGet(endpoint);

      if (resp.status !== 200) {
        throw new Error(`unexpected status code: ${resp.status}`);
      }

      this._devicesCache = (await resp.json()) as DevicesResponse;
    }
    return this._devicesCache;
  },

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

export default switchbot as Pick<
  typeof switchbot,
  "DeviceTypeFor" | "FetchDevices"
>;
