import { QueryHeadRecords } from "@/lib/bigquery";
import { env } from "@/lib/envvars";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const rows = await QueryHeadRecords(env("PROJECT_ID"));
  return NextResponse.json({ rows });
}
