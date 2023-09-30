import assert from "node:assert";
import { describe, it } from "node:test";
import { Record } from "./bigquery";
import { MacAddress, TimeStr } from "./parser";
import { env } from "./envvars";

describe("bigquery", () => {
  // BigQueryエミュレータを用意するのは面倒なので、devの実環境にinsertして結果を目視するかたちで検証する
  it("Record", () => {
    assert.doesNotReject(async () => {
      const project = env("projectId");
      await Record(project, "switchbot", "metrics", [
        {
          Time: TimeStr("2023-09-27T07:38:44.951123+00:00"),
          DeviceId: MacAddress("test"),
          Type: "Battery",
          Value: 100,
        },
        {
          Time: TimeStr("2023-09-27T07:38:44.951123+00:00"),
          DeviceId: MacAddress("test"),
          Type: "Temperature",
          Value: 20.7,
        },
      ]);
    });
  });
});
