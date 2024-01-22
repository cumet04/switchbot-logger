import switchbot from "./switchbot";

describe.skip("switchbot", () => {
  // API疎通自体の関数のため、実際のエンドポイントに疎通して確認する。
  // 特に認証ヘッダの生成が正しいかは実際に疎通して確認する必要がある。
  it("FetchDevices", async () => {
    const actual = await switchbot.EnsureDevices();

    expect(actual.statusCode).toBe(100);
    expect(actual.body.deviceList.length).toBeGreaterThan(0); // 一個くらいあるやろ
    const device = actual.body.deviceList[0];

    expect(device.deviceId).toMatch(/^[0-9A-Z]+$/);
    expect(typeof device.deviceName).toBe("string");
    expect(typeof device.deviceType).toBe("string");
  });
});
