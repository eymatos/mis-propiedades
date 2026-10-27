// Sesión firmada con HMAC (funciona en middleware y en el servidor).
export const SESSION_COOKIE = "gp_session";
export const SESSION_DAYS = 30;

const enc = new TextEncoder();

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET debe tener al menos 32 caracteres.");
  return s;
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(str: string): string {
  const pad = str.length % 4 ? "=".repeat(4 - (str.length % 4)) : "";
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function sign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return b64url(new Uint8Array(sig));
}

export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowed(email: string): boolean {
  return allowedEmails().includes(email.trim().toLowerCase());
}

export async function createSessionToken(email: string): Promise<string> {
  const payload = b64url(
    enc.encode(JSON.stringify({ email, exp: Date.now() + SESSION_DAYS * 86_400_000 })),
  );
  return `${payload}.${await sign(payload)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = await sign(payload);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const data = JSON.parse(fromB64url(payload)) as { email?: string; exp?: number };
    if (!data.email || !data.exp || data.exp < Date.now()) return null;
    return isAllowed(data.email) ? data.email : null;
  } catch {
    return null;
  }
}
