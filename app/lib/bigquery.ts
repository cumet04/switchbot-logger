import { setTimeout } from "timers/promises";

export async function Record() {
  const res = await setTimeout(500, "result");
  throw new Error("Hoge");
  return;
}
