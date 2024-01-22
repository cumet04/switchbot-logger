import { Record } from "@/lib/bigquery";
import { env } from "@/lib/envvars";
import { Parse } from "@/lib/parser";
import switchbot from "@/lib/switchbot";
import { NextResponse } from "next/server";

// TODO: sourcemapだせない？

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const auth = params.slug;
  if (auth !== env("AUTH_PATH"))
    return NextResponse.json({ error: "invalid auth" }, { status: 401 });

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
