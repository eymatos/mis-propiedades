import { NextResponse } from "next/server";
import { appOrigin } from "@/lib/google";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST(req: Request) {
  const res = NextResponse.redirect(`${appOrigin(req.url)}/login`, { status: 303 });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
