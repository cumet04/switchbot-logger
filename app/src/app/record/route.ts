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
  const raw = await request.text();

  // raspi側の具合が良くない場合に時折ゼロ文字が混入することがあるので、それの対応 refs #43
  // 今のところゼロ文字以外が入る場合や先頭・末尾以外に入る場合は見たことないので、それ以外があったら検知（エラー）できるようにする
  // eslint-disable-next-line no-control-regex
  const input = raw.replace(/^\x00*/, "").replace(/\x00*$/, "");

  await switchbot.EnsureDevices();
  // MEMO: Parseの中でJSON.parseしたり型確認したりしており、入力値不正のハンドリングの意味で不適切。
  // Bad Requestを先に返せるようにする意味でも、JSON.parseと型チェックは切り出したほうがよい
  const btRecords = input
    .split("\n")
    .filter((s) => s.length > 0)
    .flatMap((msg) => Parse(msg));

  // 入力データは受け取ったが、その中にswitchbotのデータが無い場合は正常に起こり得るので
  // その場合は0件記録として正常終了する。 refs #109
  // なんらかのバグで異常にゼロ件になる可能性はあるが、それはBQ側のアラートで検知することに
  if (btRecords.length === 0) return NextResponse.json({ recorded: 0 });

  const records = btRecords.map((r) => ({
    Time: r.Time,
    DeviceId: r.Address,
    Type: r.Type,
    Value: r.Value,
  }));

  await Record(env("PROJECT_ID"), "switchbot", "metrics", records);

  return NextResponse.json({ recorded: records.length });
}
