import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { googleAuth, properties, tenants } from "./db/schema";
import { getSetting, setSettings } from "./settings";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  // Solo da acceso a los archivos y carpetas que crea esta app, no a todo tu Drive.
  "https://www.googleapis.com/auth/drive.file",
].join(" ");

const ROOT_FOLDER_NAME = "Gestión de Propiedades";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export class DriveNotConnectedError extends Error {
  constructor() {
    super("Google Drive no está conectado. Cierra sesión y vuelve a entrar con Google.");
  }
}

export function appOrigin(reqUrl: string): string {
  const fromEnv = process.env.APP_URL?.replace(/\/$/, "");
  return fromEnv || new URL(reqUrl).origin;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
};

export async function exchangeCode(code: string, redirectUri: string): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google rechazó el código de acceso: ${await res.text()}`);
  return (await res.json()) as TokenResponse;
}

export async function fetchUserEmail(accessToken: string): Promise<{ email: string; verified: boolean }> {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("No se pudo leer el correo de la cuenta de Google.");
  const data = (await res.json()) as { email?: string; email_verified?: boolean };
  return { email: (data.email ?? "").toLowerCase(), verified: Boolean(data.email_verified) };
}

export async function saveGoogleTokens(email: string, t: TokenResponse) {
  const expiresAt = Date.now() + t.expires_in * 1000;
  await getDb()
    .insert(googleAuth)
    .values({ id: 1, email, accessToken: t.access_token, refreshToken: t.refresh_token ?? null, expiresAt })
    .onConflictDoUpdate({
      target: googleAuth.id,
      set: {
        email,
        accessToken: t.access_token,
        expiresAt,
        updatedAt: new Date(),
        ...(t.refresh_token ? { refreshToken: t.refresh_token } : {}),
      },
    });
}

export async function driveStatus(): Promise<{ connected: boolean; email: string | null }> {
  const [row] = await getDb().select().from(googleAuth).where(eq(googleAuth.id, 1));
  return { connected: Boolean(row?.refreshToken), email: row?.email ?? null };
}

async function getAccessToken(): Promise<string> {
  const db = getDb();
  const [row] = await db.select().from(googleAuth).where(eq(googleAuth.id, 1));
  if (!row?.refreshToken) throw new DriveNotConnectedError();
  if (row.accessToken && row.expiresAt && row.expiresAt > Date.now() + 60_000) return row.accessToken;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: row.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (body.includes("invalid_grant")) {
      await db.update(googleAuth).set({ refreshToken: null }).where(eq(googleAuth.id, 1));
      throw new DriveNotConnectedError();
    }
    throw new Error(`No se pudo renovar el acceso a Google Drive: ${body}`);
  }
  const t = (await res.json()) as TokenResponse;
  await saveGoogleTokens(row.email, t);
  return t.access_token;
}

async function drive<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(url.startsWith("http") ? url : `https://www.googleapis.com${url}`, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = new Error(`Error de Google Drive (${res.status}): ${await res.text()}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type DriveFile = {
  id: string;
  name: string;
  mimeType?: string;
  size?: string;
  webViewLink?: string;
  trashed?: boolean;
};

const FILE_FIELDS = "id,name,mimeType,size,webViewLink,trashed";

function q(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "-").trim().slice(0, 120) || "Sin nombre";
}

export async function getFile(id: string): Promise<DriveFile | null> {
  try {
    return await drive<DriveFile>(`/drive/v3/files/${encodeURIComponent(id)}?fields=${FILE_FIELDS}`);
  } catch (e) {
    if ((e as { status?: number }).status === 404) return null;
    throw e;
  }
}

async function findOrCreateFolder(name: string, parentId?: string): Promise<string> {
  const parentClause = parentId ? ` and '${q(parentId)}' in parents` : "";
  const query = `mimeType='${FOLDER_MIME}' and name='${q(name)}' and trashed=false${parentClause}`;
  const list = await drive<{ files: DriveFile[] }>(
    `/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=1`,
  );
  if (list.files?.[0]) return list.files[0].id;
  const created = await drive<DriveFile>("/drive/v3/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parentId ? { parents: [parentId] } : {}) }),
  });
  return created.id;
}

let rootCache: string | null = null;

export async function getRootFolderId(): Promise<string> {
  if (rootCache) return rootCache;
  const saved = await getSetting("drive_root_folder_id");
  if (saved) {
    const f = await getFile(saved);
    if (f && !f.trashed) {
      rootCache = saved;
      return saved;
    }
  }
  const id = await findOrCreateFolder(ROOT_FOLDER_NAME);
  await setSettings({ drive_root_folder_id: id });
  rootCache = id;
  return id;
}

export async function getSubfolder(parentId: string, name: string): Promise<string> {
  return findOrCreateFolder(safeName(name), parentId);
}

export async function getFolderPath(...names: string[]): Promise<string> {
  let parent = await getRootFolderId();
  for (const n of names) parent = await findOrCreateFolder(safeName(n), parent);
  return parent;
}

/** Carpeta propia de un inquilino o una propiedad (se crea una sola vez y se recuerda). */
export async function getEntityFolder(kind: "tenant" | "property", id: number): Promise<string> {
  const db = getDb();
  if (kind === "tenant") {
    const [t] = await db.select().from(tenants).where(eq(tenants.id, id));
    if (!t) throw new Error("Inquilino no encontrado");
    if (t.driveFolderId) {
      const f = await getFile(t.driveFolderId);
      if (f && !f.trashed) return t.driveFolderId;
    }
    const folder = await getFolderPath("Inquilinos", `${t.fullName} (#${t.id})`);
    await db.update(tenants).set({ driveFolderId: folder }).where(eq(tenants.id, id));
    return folder;
  }
  const [p] = await db.select().from(properties).where(eq(properties.id, id));
  if (!p) throw new Error("Propiedad no encontrada");
  if (p.driveFolderId) {
    const f = await getFile(p.driveFolderId);
    if (f && !f.trashed) return p.driveFolderId;
  }
  const folder = await getFolderPath("Propiedades", `${p.name} (#${p.id})`);
  await db.update(properties).set({ driveFolderId: folder }).where(eq(properties.id, id));
  return folder;
}

export async function uploadFile(opts: {
  name: string;
  mimeType: string;
  data: Uint8Array;
  parentId: string;
}): Promise<DriveFile> {
  const boundary = `gp${crypto.randomUUID().replace(/-/g, "")}`;
  const meta = JSON.stringify({ name: opts.name, parents: [opts.parentId], mimeType: opts.mimeType });
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${opts.mimeType}\r\n\r\n`;
  const tail = `\r\n--${boundary}--`;
  const body = new Blob([head, new Uint8Array(opts.data), tail]);
  return drive<DriveFile>(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=${FILE_FIELDS}`,
    { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body },
  );
}

/**
 * Crea una sesión de subida para que el navegador envíe el archivo directo a Drive
 * (así no hay límite de tamaño de Vercel).
 */
export async function createUploadSession(opts: {
  name: string;
  mimeType: string;
  size: number;
  parentId: string;
  origin: string;
}): Promise<string> {
  const token = await getAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=${FILE_FIELDS}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": opts.mimeType,
        "X-Upload-Content-Length": String(opts.size),
        Origin: opts.origin,
      },
      body: JSON.stringify({ name: opts.name, parents: [opts.parentId], mimeType: opts.mimeType }),
    },
  );
  const location = res.headers.get("location");
  if (!res.ok || !location) throw new Error(`No se pudo iniciar la subida a Drive: ${await res.text()}`);
  return location;
}

export function folderUrl(id: string): string {
  return `https://drive.google.com/drive/folders/${id}`;
}
