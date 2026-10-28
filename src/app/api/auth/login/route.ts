import { NextResponse } from "next/server";
import { databaseUrl, ensureSchema } from "@/lib/db";
import { blobConfigured } from "@/lib/blob-env";
import { checkPassword, createSessionToken, SESSION_COOKIE, SESSION_DAYS } from "@/lib/session";

export const dynamic = "force-dynamic";

function origin(req: Request): string {
  return process.env.APP_URL?.replace(/\/$/, "") || new URL(req.url).origin;
}

export async function POST(req: Request) {
  const missing = ["APP_PASSWORD"].filter((k) => !process.env[k]);
  if (!databaseUrl()) missing.push("DATABASE_URL (conecta Neon en Storage)");
  if (!blobConfigured()) missing.push("Vercel Blob (conecta el almacén en Storage)");
  if (missing.length) {
    return NextResponse.redirect(`${origin(req)}/login?error=config&faltan=${encodeURIComponent(missing.join(","))}`, { status: 303 });
  }

  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  if (!(await checkPassword(password))) {
    await new Promise((r) => setTimeout(r, 1200)); // frena intentos repetidos
    return NextResponse.redirect(`${origin(req)}/login?error=clave`, { status: 303 });
  }

  await ensureSchema();
  const res = NextResponse.redirect(`${origin(req)}/`, { status: 303 });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  return res;
}
