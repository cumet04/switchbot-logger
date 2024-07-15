import {test, expect, request} from '@playwright/test';
import {describe} from 'node:test';

describe('GET /viewer', async () => {
  test('正常閲覧', async ({page}) => {
    // 閲覧してconsoleエラーが出ないこと
    const errors: Error[] = [];
    page.on('pageerror', e => errors.push(e));
    const resp = await page.goto('/viewer');
    expect(resp?.status()).toBe(200);
    expect(errors).toMatchObject([]);

    // TODO: あれとこれのラベルとハコが表示されている、とか見てもいい
  });
});

describe('POST /record', async () => {
  test('正常データ保存', async () => {
    const context = await request.newContext();

    const now = new Date();
    const nowStr = now.toISOString();
    const nowStrPi = nowStr.replace(/Z$/, '000+00:00'); // raspi側の出力に合わせる

    // 実際のデータの時刻とMACアドレスを変えたもの。
    // 実環境に似せて、メトリクスとして取得できるセンサデータとそれ以外の不明データを用意する。
    const meterAddr = 'ac:de:48:28:ac:ed';
    const unknownAddr = 'ac:de:48:1f:1a:8d';
    const meterData = `{"time": "${nowStrPi}", "addr": "${meterAddr}", "structs": [{"adtype": 1, "desc": "Flags", "value": "06"}, {"adtype": 255, "desc": "Manufacturer", "value": "5900ecacde4828aced"}, {"adtype": 7, "desc": "Complete 128b Services", "value": "cba20d00-224d-11e6-9fb8-0002a5d5c51b"}, {"adtype": 22, "desc": "16b Service Data", "value": "000d540064038e26"}]}`;
    const unknownData = `{"time": "${nowStrPi}", "addr": "${unknownAddr}", "structs": [{"adtype": 1, "desc": "Flags", "value": "1a"}, {"adtype": 10, "desc": "Tx Power", "value": "07"}, {"adtype": 255, "desc": "Manufacturer", "value": "4c001006261a10f4dac6"}]}`;
    const postData = `${meterData}\n${unknownData}\n`; // 実データはJSONが改行で区切られているのでそれを再現

    // TEST: データのPOSTが成功すること
    const resp1 = await context.post('/record', {data: postData});
    expect(resp1.status()).toBe(200);

    // TEST: debug用データ取得が成功すること
    const resp2 = await context.get('/record/debug');
    expect(resp2.status()).toBe(200);

    const rows = (await resp2.json()).rows as {
      Time: string;
      DeviceId: string;
      Type: string;
      Value: number;
    }[];

    // TEST: 取得した直近データに不明デバイスのデータが含まれていないこと
    expect(rows.filter(r => r.DeviceId === unknownAddr)).toEqual([]);

    // TEST: 取得した直近データに、直前に送信した温湿度計のデータが過不足なく含まれていること
    expect(
      rows.filter(r => r.DeviceId === meterAddr && r.Time === nowStr)
    ).toEqual([
      {
        Time: nowStr,
        DeviceId: meterAddr,
        Type: 'Battery',
        Value: 100,
      },
      {
        Time: nowStr,
        DeviceId: meterAddr,
        Type: 'Temperature',
        Value: 14.3,
      },
      {
        Time: nowStr,
        DeviceId: meterAddr,
        Type: 'Humidity',
        Value: 38,
      },
    ]);
  });
});
