import assert from "node:assert";
import test from "node:test";
import { Record } from "./bigquery";

// BigQueryエミュレータを用意するのは面倒なので、devの実環境にinsertして結果を目視するかたちで検証する
test("it success", () => {
  assert.doesNotReject(async () => {
    await Record(process.env.PROJECT_ID_DEVELOPMENT!, "switchbot", "metrics", [
      {
        Time: new Date(),
        DeviceId: "test",
        Type: "Battery",
        Value: 100,
      },
      {
        Time: new Date(),
        DeviceId: "test",
        Type: "Temperature",
        Value: 20.7,
      },
    ]);
  });
});
