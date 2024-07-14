import { Record } from "@/lib/bigquery";
import { env } from "@/lib/envvars";
import { Parse } from "@/lib/parser";
import switchbot from "@/lib/switchbot";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// TODO: sourcemapだせない？
// TODO: 投げられたエラーオブジェクトのネスト深い場合に中身が展開されず、何もわからない。カスタムロギングを入れないといけないかも

export async function POST(request: Request) {
  const input = await request.text();

  await switchbot.EnsureDevices();
  // MEMO: Parseの中でJSON.parseしたり型確認したりしており、入力値不正のハンドリングの意味で不適切。
  // Bad Requestを先に返せるようにする意味でも、JSON.parseと型チェックは切り出したほうがよい
  const btRecords = input
    .split("\n")
    .filter((s) => s.length > 0)
    .flatMap((msg) => Parse(msg));

  const records = btRecords.map((r) => ({
    Time: r.Time,
    DeviceId: r.Address,
    Type: r.Type,
    Value: r.Value,
  }));

  await Record(env("PROJECT_ID"), "switchbot", "metrics", records);

  return NextResponse.json({ message: "ok" });
}
