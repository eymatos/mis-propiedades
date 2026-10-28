// Sesión firmada con HMAC (funciona en middleware y en el servidor).
export const SESSION_COOKIE = "gp_session";
export const SESSION_DAYS = 30;

const enc = new TextEncoder();

/** Clave para firmar la sesión: AUTH_SECRET si existe; si no, se deriva de la contraseña y la base de datos. */
function secret(): string {
  const explicit = process.env.AUTH_SECRET;
  if (explicit && explicit.length >= 16) return explicit;
  const pass = process.env.APP_PASSWORD;
  if (!pass) throw new Error("Falta la variable APP_PASSWORD.");
  return `${pass}::mis-propiedades-sesion`;
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

async function hmac(key: string, data: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(data));
  return b64url(new Uint8Array(sig));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Compara la contraseña escrita con APP_PASSWORD sin filtrar información por tiempos. */
export async function checkPassword(input: string): Promise<boolean> {
  const real = process.env.APP_PASSWORD;
  if (!real) return false;
  const [a, b] = await Promise.all([hmac("pw", input), hmac("pw", real)]);
  return safeEqual(a, b);
}

export async function createSessionToken(): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ u: "owner", exp: Date.now() + SESSION_DAYS * 86_400_000 })));
  return `${payload}.${await hmac(secret(), payload)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  if (!safeEqual(await hmac(secret(), payload), sig)) return false;
  try {
    const data = JSON.parse(fromB64url(payload)) as { exp?: number };
    return Boolean(data.exp && data.exp > Date.now());
  } catch {
    return false;
  }
}

/** Lee la cookie de una petición (para rutas que no pasan por el middleware). */
export async function isRequestAuthenticated(req: Request): Promise<boolean> {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return verifySessionToken(match ? decodeURIComponent(match[1]) : undefined).catch(() => false);
}
