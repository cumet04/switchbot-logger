import { QueryHeadRecords } from "@/lib/bigquery";
import { env } from "@/lib/envvars";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const auth = params.slug;
  if (auth !== env("AUTH_PATH"))
    return NextResponse.json({ error: "invalid auth" }, { status: 401 });

  const rows = await QueryHeadRecords(env("PROJECT_ID"));
  return NextResponse.json({ rows });
}
