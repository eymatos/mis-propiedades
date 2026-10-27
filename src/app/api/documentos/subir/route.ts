import { NextResponse } from "next/server";
import { safeName, uploadFile } from "@/lib/google";
import { folderForTarget, parseTarget, registerDocument } from "@/lib/documents";

export const dynamic = "force-dynamic";

// Ruta de respaldo para archivos pequeños (Vercel limita el cuerpo a ~4.5 MB).
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No se recibió archivo." }, { status: 400 });
    const fields = Object.fromEntries(form.entries());
    const target = parseTarget(fields);
    const uploaded = await uploadFile({
      name: safeName(String(fields.name || file.name)),
      mimeType: file.type || "application/octet-stream",
      data: new Uint8Array(await file.arrayBuffer()),
      parentId: await folderForTarget(target),
    });
    const doc = await registerDocument(uploaded, String(fields.category ?? "otro"), target);
    return NextResponse.json({ ok: true, id: doc.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
