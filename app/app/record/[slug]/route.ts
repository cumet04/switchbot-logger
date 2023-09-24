import { Record } from "@/lib/bigquery";
import { env } from "@/lib/envvars";
import { Parse } from "@/lib/parser";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const auth = params.slug;
  if (auth !== "hoge")
    return NextResponse.json({ error: "invalid auth" }, { status: 401 });

  const input = await request.text();

  const btRecords = input.split("\n").flatMap((msg) => Parse(msg));

  const records = btRecords.map((r) => ({
    Time: r.Time,
    DeviceId: r.Address,
    Type: r.Type,
    Value: r.Value,
  }));

  await Record(env("projectId"), "switchbot", "metrics", records);

  return NextResponse.json({ message: "ok" });
}
