import { NextResponse } from "next/server";
import { parseTarget, registerDocument } from "@/lib/documents";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const pathname = String(body.pathname ?? "");
    if (!pathname || pathname.includes("..")) {
      return NextResponse.json({ error: "Archivo no válido." }, { status: 400 });
    }
    const doc = await registerDocument({
      pathname,
      name: String(body.name ?? pathname.split("/").pop()),
      mimeType: body.mimeType ? String(body.mimeType) : null,
      size: Number(body.size) || null,
      category: String(body.category ?? "otro"),
      target: parseTarget(body),
    });
    return NextResponse.json({ ok: true, id: doc.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
