import { NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db";
import { ensureCharges } from "@/lib/billing";
import { saveBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel la ejecuta cada mañana (ver vercel.json): genera las cuotas del mes
// y guarda un respaldo de toda la información en Vercel Blob.
export async function GET(req: Request) {
  // Con CRON_SECRET, Vercel envía la clave; sin ella, solo se acepta la llamada del programador de Vercel.
  const secret = process.env.CRON_SECRET;
  const allowed = secret
    ? req.headers.get("authorization") === `Bearer ${secret}`
    : (req.headers.get("user-agent") ?? "").startsWith("vercel-cron");
  if (!allowed) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  await ensureSchema();
  const created = await ensureCharges();
  let backup: string;
  try {
    backup = (await saveBackup()).path;
  } catch (e) {
    backup = `error: ${(e as Error).message}`;
  }
  return NextResponse.json({ ok: true, cuotasCreadas: created, respaldo: backup });
}
