import { BigQuery } from "@google-cloud/bigquery";

export async function Record(
  projectId: string,
  dataset: string,
  table: string,
  data: SensorRecord[]
) {
  const bigquery = new BigQuery();
  await bigquery
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
