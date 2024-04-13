import { env } from "@/lib/envvars";
import switchbot from "@/lib/switchbot";
import { Query } from "@/lib/bigquery";
import { DeviceId, IdToMac, MacToId } from "@/lib/parser";
import { BigQueryTimestamp } from "@google-cloud/bigquery";
import { Chart } from "./Chart";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page({ params }: { params: { slug: string } }) {
  const auth = params.slug;
  if (auth !== env("AUTH_PATH")) return notFound(); // notFoundではないのだが、nextではpage内では多分これしか手がない

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
    AND Type IN ('Temperature', 'Humidity', 'Load')
  GROUP BY 1,2
  ORDER BY 1
  `;

  // MEMO: ある程度キャッシュできたほうがいい
  const rows = await Query(env("PROJECT_ID"), query);

  const temperature: ChartRecord[] = [];
  const humidity: ChartRecord[] = [];
  const load: ChartRecord[] = [];
  rows.forEach((r) => {
    const entries = Object.keys(r)
      .filter((r) => r !== "Time" && r !== "Type")
      .map((id) => [
        switchbot.DeviceNameFor(DeviceId(id.replace(/^D/, ""))),
        r[id],
      ])
      .filter(([, v]) => v !== null);
    /* eslint-disable @typescript-eslint/consistent-type-assertions */
    const record = {
      ...Object.fromEntries(entries),
      name: new Date((r.Time as BigQueryTimestamp).value).toLocaleString(
        "ja-JP",
        { timeStyle: "short", timeZone: "Asia/Tokyo" }
      ),
    } as ChartRecord;
    /* eslint-enable @typescript-eslint/consistent-type-assertions */
    if (r.Type === "Temperature") temperature.push(record);
    if (r.Type === "Humidity") humidity.push(record);
    if (r.Type === "Load") load.push(record);
  });

  return (
    <main>
      <Chart name="Temperature" data={temperature} />
      <Chart name="Humidity" data={humidity} />
      <Chart name="Load" data={load} />
    </main>
  );
}

type ChartRecord = { name: string } & { [key in string]: number };
