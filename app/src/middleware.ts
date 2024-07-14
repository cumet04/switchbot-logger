import { NextRequest, NextResponse } from "next/server";
import { env } from "./lib/envvars";

export function middleware(request: NextRequest) {
  const authValue = request.headers.get("authorization")?.split(" ")[1] ?? "";
  const [user, pass] = Buffer.from(authValue, "base64").toString().split(":");

  if (user === env("BASIC_USER") && pass === env("BASIC_PASS")) {
    return NextResponse.next();
  } else {
    return new Response("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="login"',
      },
    });
  }
}
