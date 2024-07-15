import { appenv, env } from "@/lib/envvars";
import switchbot from "@/lib/switchbot";
import { Query } from "@/lib/bigquery";
import { DeviceId, IdToMac, MacToId } from "@/lib/parser";
import { BigQueryTimestamp } from "@google-cloud/bigquery";
import { Chart, ChartRecord } from "./Chart";
import { Refresher } from "./Refresher";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  const [temperature, humidity, load] = await fetchChartData();

  // 本番以外では動作確認などしやすいように短い時間で動作させる
  // 1分より短くても良いが、更新時刻表示が分単位のため、確実に変化が起こる1分にしておく
  const refresh = appenv() === "production" ? 10 : 1;

  return (
    <main>
      <Refresher minutes={refresh} />
      <Chart name="Temperature" data={temperature} />
      <Chart name="Humidity" data={humidity} />
      <Chart name="Load" data={load} />
    </main>
  );
}

async function fetchChartData() {
  // return [[], [], []]; // ローカル検証用

  await switchbot.EnsureDevices();
  const devices = (
    ["Plug Mini (US)", "Plug Mini (JP)", "Meter", "WoIOSensor"] as const
  ).flatMap((type) => switchbot.DevicesFor(type));

  const deviceMacs = devices.map((d) => IdToMac(d.deviceId));
  const valuesColumns = deviceMacs
    .map(
      // ASで指定するカラム名にIDをそのまま使うと、先頭が数字だった際にエラーになるので、アルファベットのプレフィックスを付与
      (mac) => `AVG(IF (DeviceId = '${mac}', Value, NULL)) AS D${MacToId(mac)}`
    )
    .join(",");

  const types = ["Temperature", "Humidity", "Load"] as const;
  type Type = (typeof types)[number];
  const query = `
  SELECT
  	TIMESTAMP_TRUNC(TIMESTAMP_SUB(Time, INTERVAL MOD(EXTRACT(MINUTE FROM Time), 1) MINUTE),MINUTE) AS Time,
    Type,
    ${valuesColumns}
  FROM
    switchbot.metrics
  WHERE
    Time > DATETIME_SUB(CURRENT_TIMESTAMP(), INTERVAL 4 HOUR)
    AND DeviceId IN ('${deviceMacs.join("','")}')
    AND Type IN (${types.map((t) => `'${t}'`).join(",")})
  GROUP BY 1,2
  ORDER BY 1
  `;

  // MEMO: ある程度キャッシュできたほうがいい
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const rows = (await Query(env("PROJECT_ID"), query)) as ({
    Time: BigQueryTimestamp;
    Type: Type;
  } & { [key in `D${string}`]: number })[];
  const isDeviceId = (key: string): key is `D${string}` => key.startsWith("D");

  const temperature: ChartRecord[] = [];
  const humidity: ChartRecord[] = [];
  const load: ChartRecord[] = [];
  rows.forEach((r) => {
    const entries = Object.keys(r)
      .filter(isDeviceId)
      .map((id) => [
        switchbot.DeviceNameFor(DeviceId(id.replace(/^D/, ""))),
        r[id],
      ])
      .filter(([, v]) => v !== null);

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const record = {
      ...Object.fromEntries(entries),
      time: new Date(r.Time.value).toLocaleString("ja-JP", {
        timeStyle: "short",
        timeZone: "Asia/Tokyo",
      }),
    } as ChartRecord;

    if (r.Type === "Temperature") temperature.push(record);
    if (r.Type === "Humidity") humidity.push(record);
    if (r.Type === "Load") load.push(record);
  });

  return [temperature, humidity, load];
}
