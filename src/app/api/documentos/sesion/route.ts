import { NextResponse } from "next/server";
import { appOrigin, createUploadSession, safeName } from "@/lib/google";
import { folderForTarget, parseTarget } from "@/lib/documents";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const name = safeName(String(body.name ?? "documento"));
    const mimeType = String(body.mimeType || "application/octet-stream");
    const size = Number(body.size ?? 0);
    const parentId = await folderForTarget(parseTarget(body));
    const uploadUrl = await createUploadSession({ name, mimeType, size, parentId, origin: appOrigin(req.url) });
    return NextResponse.json({ uploadUrl });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
