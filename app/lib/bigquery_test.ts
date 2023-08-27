import assert from "node:assert";
import test from "node:test";
import { Record } from "./bigquery";

test("it success", () => {
  assert.doesNotReject(async () => {
    await Record();
  });
});
