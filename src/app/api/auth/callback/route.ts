import { NextResponse, type NextRequest } from "next/server";
import { ensureSchema } from "@/lib/db";
import { appOrigin, exchangeCode, fetchUserEmail, saveGoogleTokens } from "@/lib/google";
import { createSessionToken, isAllowed, SESSION_COOKIE, SESSION_DAYS } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = appOrigin(req.url);
  const fail = (code: string) => NextResponse.redirect(`${origin}/login?error=${code}`);

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (req.nextUrl.searchParams.get("error")) return fail("cancelado");
  if (!code || !state || state !== req.cookies.get("gp_oauth_state")?.value) return fail("estado");

  try {
    const tokens = await exchangeCode(code, `${origin}/api/auth/callback`);
    const { email, verified } = await fetchUserEmail(tokens.access_token);
    if (!verified || !isAllowed(email)) return fail("no_autorizado");

    await ensureSchema();
    await saveGoogleTokens(email, tokens);

    const res = NextResponse.redirect(`${origin}/`);
    res.cookies.set(SESSION_COOKIE, await createSessionToken(email), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DAYS * 86_400,
    });
    res.cookies.delete("gp_oauth_state");
    return res;
  } catch (e) {
    console.error("Error en login:", e);
    return fail("google");
  }
}
