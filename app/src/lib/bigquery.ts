import { BigQuery, BigQueryTimestamp } from "@google-cloud/bigquery";

export async function Record(
  projectId: string,
  dataset: string,
  table: string,
  data: SensorRecord[]
) {
  const bigquery = new BigQuery({ projectId });
  await bigquery
    .dataset(dataset)
    .table(table)
    .insert(
      data.map((d) => ({
        // MEMO: マイクロ秒精度の値を渡しても、ここでマイクロ秒まで切り捨てられるようだ
        Time: bigquery.timestamp(d.Time),
        DeviceId: d.DeviceId,
        Type: d.Type,
        Value: d.Value,
      }))
    );
}

export async function Query(projectId: string, query: string) {
  const bigquery = new BigQuery({ projectId });
  const resp = await bigquery.query(query);

  // MEMO: respは0番目に結果配列が、1, 2番目はqueryやresulet metadataが入る
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return resp[0] as Record<string, unknown>[];
}

// テストやデバッグ用に最新のデータを取得する
export async function QueryHeadRecords(projectId: string) {
  const bigquery = new BigQuery({ projectId });

  const query = [
    "SELECT Time, DeviceId, Type, Value",
    "FROM switchbot.metrics",
    // データ投入はraspiから1分ごとなので、直近2分を取得すればなんらかのデータが含まれるはず
    "WHERE Time > DATETIME_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 MINUTE)",
    "LIMIT 500", // 念の為上限を設ける
  ].join(" ");
  const resp = await bigquery.query(query);
  const rows = resp.flatMap((r) => r);

  return toSensorRecords(rows);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSensorRecords(rows: any[]) {
  return rows.map((r) => {
    const keys = Object.keys(r); // eslint-disable-line @typescript-eslint/no-unsafe-argument
    const isSensorRecord =
      keys.includes("Time") &&
      keys.includes("DeviceId") &&
      keys.includes("Type") &&
      keys.includes("Value");
    if (!isSensorRecord) {
      throw new Error("rows is not SensorRecord[]; keys: " + keys.join(", "));
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return {
      ...r,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      Time: r.Time.value, // これはミリ秒精度までしか出てないが、ひとまず気にしない
      // Timestampな値はBigQueryTimestamp型で返ってくるので、valueでstringな値が出せる
    } as SensorRecord;
  });
}

// next.js 14.0.2-canary.19以降、terserのmangleオプションが完全に有効化されたため、
// bigqueryクライアントでクラス名がmangleされないことに依存するコードが壊れることへの対処。
// next.jsのオプションは上書きする手段が無いため、クラス名の方を強制的にを再上書きすることで対応している。
// refs #38
Object.defineProperty(BigQueryTimestamp, "name", {
  value: "BigQueryTimestamp",
});
