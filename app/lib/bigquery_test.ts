import assert from "node:assert";
import { describe, it } from "node:test";
import { Record } from "./bigquery";

describe("bigquery", () => {
  // BigQueryエミュレータを用意するのは面倒なので、devの実環境にinsertして結果を目視するかたちで検証する
  it("Record", () => {
    assert.doesNotReject(async () => {
      const project = process.env.PROJECT_ID_DEVELOPMENT!;
      await Record(project, "switchbot", "metrics", [
        {
          Time: new Date(),
          DeviceId: "test" as MacAddress,
          Type: "Battery",
          Value: 100,
        },
        {
          Time: new Date(),
          DeviceId: "test" as MacAddress,
          Type: "Temperature",
          Value: 20.7,
        },
      ]);
    });
  });
});
