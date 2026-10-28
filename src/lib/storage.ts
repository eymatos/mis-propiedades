import { del, get, list, put } from "@vercel/blob";

// Archivos en Vercel Blob, en un almacén PRIVADO: solo se pueden ver a través de la app
// (ruta /api/archivo), que exige haber iniciado sesión.

const ACCESS = "private" as const;

export function cleanFileName(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\w.\- ]+/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 100) || "archivo"
  );
}

export async function saveFile(pathname: string, data: Blob | Uint8Array | string, contentType: string) {
  const body = data instanceof Uint8Array ? new Blob([new Uint8Array(data)], { type: contentType }) : data;
  return put(pathname, body, { access: ACCESS, addRandomSuffix: true, contentType });
}

export async function readFile(pathname: string): Promise<{ stream: ReadableStream; contentType?: string } | null> {
  const result = (await get(pathname, { access: ACCESS })) as unknown as {
    stream?: ReadableStream;
    contentType?: string;
    blob?: { contentType?: string };
  } | null;
  if (!result?.stream) return null;
  return { stream: result.stream, contentType: result.blob?.contentType ?? result.contentType };
}

export async function deleteFile(pathname: string) {
  try {
    await del(pathname);
  } catch (e) {
    console.error("No se pudo borrar el archivo:", e);
  }
}

/** Borra los respaldos más viejos y deja los últimos `keep`. */
export async function pruneBackups(keep = 60) {
  const { blobs } = await list({ prefix: "respaldos/", limit: 1000 });
  const sorted = [...blobs].sort((a, b) => String(b.pathname).localeCompare(String(a.pathname)));
  for (const b of sorted.slice(keep)) await deleteFile(b.pathname);
}

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  json: "application/json",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function guessMime(pathname: string): string {
  const ext = pathname.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] ?? "application/octet-stream";
}

export function fileUrl(pathname: string, download = false): string {
  return `/api/archivo?path=${encodeURIComponent(pathname)}${download ? "&descargar=1" : ""}`;
}
