import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function middleware(req: NextRequest) {
  const email = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value).catch(() => null);
  if (email) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Todo requiere sesión excepto el login, la tarea diaria y los archivos públicos.
  matcher: [
    "/((?!login|api/auth|api/cron|_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest).*)",
  ],
};
