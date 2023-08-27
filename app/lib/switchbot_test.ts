import assert from "node:assert";
import { it, describe } from "node:test";
import switchbot from "./switchbot";

describe("switchbot", () => {
  // API疎通自体の関数のため、実際のエンドポイントに疎通して確認する。
  // 特に認証ヘッダの生成が正しいかは実際に疎通して確認する必要がある。
  it("FetchDevices", async () => {
    const actual = await switchbot.FetchDevices();

    assert.equal(actual.statusCode, 100);
    assert.ok(actual.body.deviceList.length > 0); // 一個くらいあるやろ
    const device = actual.body.deviceList[0];

    assert.match(device.deviceId, /^[0-9A-Z]+$/);
    assert.equal(typeof device.deviceName, "string");
    assert.equal(typeof device.deviceType, "string");
  });
});
