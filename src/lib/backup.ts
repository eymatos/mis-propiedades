import { getDb } from "./db";
import { appSettings, charges, documents, leases, payments, properties, tenants, units } from "./db/schema";
import { todayISO } from "./dates";
import { pruneBackups, saveFile } from "./storage";
import { setSettings } from "./settings";

/** Copia completa de los datos. */
export async function buildBackup() {
  const db = getDb();
  const [p, u, t, l, c, pay, d, s] = await Promise.all([
    db.select().from(properties),
    db.select().from(units),
    db.select().from(tenants),
    db.select().from(leases),
    db.select().from(charges),
    db.select().from(payments),
    db.select().from(documents),
    db.select().from(appSettings),
  ]);
  return {
    app: "gestion-propiedades",
    version: 1,
    createdAt: new Date().toISOString(),
    data: {
      properties: p,
      units: u,
      tenants: t,
      leases: l,
      charges: c,
      payments: pay,
      documents: d,
      settings: s,
    },
  };
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Hoja de pagos en CSV (se abre con Excel o Google Sheets). */
export async function buildPaymentsCsv(): Promise<string> {
  const { loadCharges } = await import("./billing");
  const db = getDb();
  const [all, pays] = await Promise.all([loadCharges(), db.select().from(payments)]);
  const byId = new Map(all.map((c) => [c.id, c]));
  const header = ["Recibo", "Fecha pago", "Inquilino", "Propiedad", "Unidad", "Concepto", "Monto", "Método", "Referencia"];
  const lines = [header.join(",")];
  for (const p of pays.sort((a, b) => a.paidAt.localeCompare(b.paidAt))) {
    const c = byId.get(p.chargeId);
    lines.push(
      [p.receiptNumber, p.paidAt, c?.tenant.fullName, c?.property.name, c?.unit.name, c?.label, p.amount, p.method, p.reference]
        .map(csvCell)
        .join(","),
    );
  }
  return "﻿" + lines.join("\n");
}

/** Guarda una copia completa en Vercel Blob (carpeta respaldos/) y conserva las últimas 60. */
export async function saveBackup(): Promise<{ path: string }> {
  const today = todayISO();
  const json = JSON.stringify(await buildBackup(), null, 1);
  const file = await saveFile(`respaldos/respaldo-${today}.json`, json, "application/json");
  await setSettings({ last_backup_at: new Date().toISOString(), last_backup_path: file.pathname });
  await pruneBackups(60).catch((e) => console.error("No se pudieron borrar respaldos viejos:", e));
  return { path: file.pathname };
}
