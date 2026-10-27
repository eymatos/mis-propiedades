import { NextResponse } from "next/server";
import { getFile } from "@/lib/google";
import { parseTarget, registerDocument } from "@/lib/documents";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const file = await getFile(String(body.fileId ?? ""));
    if (!file) return NextResponse.json({ error: "El archivo no aparece en Drive." }, { status: 404 });
    const doc = await registerDocument(file, String(body.category ?? "otro"), parseTarget(body));
    return NextResponse.json({ ok: true, id: doc.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
