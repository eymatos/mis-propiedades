import { NextResponse } from "next/server";
import { appOrigin, GOOGLE_SCOPES } from "@/lib/google";

export const dynamic = "force-dynamic";

const REQUIRED = ["DATABASE_URL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "ALLOWED_EMAILS", "AUTH_SECRET"];

export async function GET(req: Request) {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if ((process.env.AUTH_SECRET ?? "").length < 32 && !missing.includes("AUTH_SECRET")) missing.push("AUTH_SECRET (mínimo 32 caracteres)");
  if (missing.length) {
    return new Response(
      `Falta configurar en Vercel (Settings > Environment Variables):\n\n- ${missing.join("\n- ")}\n\nDespués de agregarlas, haz Redeploy.`,
      { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }
  const origin = appOrigin(req.url);
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: `${origin}/api/auth/callback`,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  res.cookies.set("gp_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
