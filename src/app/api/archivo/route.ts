import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { guessMime, readFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Muestra un archivo privado de Vercel Blob (el middleware ya exigió la sesión).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const path = url.searchParams.get("path") ?? "";
  if (!path || path.includes("..")) return new Response("Archivo no válido", { status: 400 });

  const file = await readFile(path).catch(() => null);
  if (!file) return new Response("Archivo no encontrado", { status: 404 });

  const [doc] = await getDb().select().from(documents).where(eq(documents.storagePath, path));
  const name = doc?.name ?? path.split("/").pop() ?? "archivo";
  const type = doc?.mimeType || file.contentType || guessMime(path);
  const disposition = url.searchParams.get("descargar") ? "attachment" : "inline";

  return new Response(file.stream, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
