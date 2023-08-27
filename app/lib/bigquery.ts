import { BigQuery } from "@google-cloud/bigquery";

type Record = {
  Time: Date;
  DeviceId: string; // MACアドレス。現在は小文字
  Type: "Battery" | "Temperature" | "Humidity" | "PowerOn" | "Load";
  Value: number;
};

export async function Record(
  projectId: string,
  dataset: string,
  table: string,
  data: Record[]
) {
  const bigquery = new BigQuery();
  bigquery
    .dataset(dataset, { projectId })
    .table(table)
    .insert(
      data.map((d) => ({
        Time: bigquery.timestamp(d.Time),
        DeviceId: d.DeviceId,
        Type: d.Type,
        Value: d.Value,
      }))
    );
}
