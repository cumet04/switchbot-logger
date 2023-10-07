import { Record } from "./bigquery";
import { MacAddress, TimeStr } from "./parser";
import { env } from "./envvars";

describe.skip("bigquery", () => {
  // BigQueryエミュレータを用意するのは面倒なので、devの実環境にinsertして結果を目視するかたちで検証する
  it("Record", async () => {
    const project = env("projectId");
    const actual = async () => {
      await Record(project, "switchbot", "metrics", [
        {
          Time: TimeStr("2023-09-27T07:38:44.951123+00:00"),
          DeviceId: MacAddress("ac:de:48:6a:05:b4"),
          Type: "Battery",
          Value: 100,
        },
        {
          Time: TimeStr("2023-09-27T07:38:44.951123+00:00"),
          DeviceId: MacAddress("ac:de:48:09:bd:a7"),
          Type: "Temperature",
          Value: 20.7,
        },
      ]);
    };

    await expect(actual()).resolves.not.toThrow();
  });
});
