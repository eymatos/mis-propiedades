import { NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db";
import { ensureCharges } from "@/lib/billing";
import { backupToDrive } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel la ejecuta cada mañana (ver vercel.json): genera las cuotas del mes
// y guarda un respaldo de toda la información en Google Drive.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  await ensureSchema();
  const created = await ensureCharges();
  let backup: string;
  try {
    const r = await backupToDrive();
    backup = r.url ?? "ok";
  } catch (e) {
    backup = `error: ${(e as Error).message}`;
  }
  return NextResponse.json({ ok: true, cuotasCreadas: created, respaldo: backup });
}
