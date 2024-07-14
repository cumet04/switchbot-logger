import { QueryHeadRecords } from "@/lib/bigquery";
import { env } from "@/lib/envvars";
import { NextResponse } from "next/server";

export async function GET() {
  const rows = await QueryHeadRecords(env("PROJECT_ID"));
  return NextResponse.json({ rows });
}
