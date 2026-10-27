import { getDb } from "./db";
import { appSettings, charges, documents, leases, payments, properties, tenants, units } from "./db/schema";
import { todayISO } from "./dates";
import { getFolderPath, uploadFile } from "./google";
import { setSettings } from "./settings";

/** Copia completa de los datos (sin las credenciales de Google). */
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
      settings: s.filter((x) => x.key !== "drive_root_folder_id"),
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

export async function backupToDrive(): Promise<{ url: string | null }> {
  const today = todayISO();
  const folder = await getFolderPath("Respaldos", today.slice(0, 4));
  const json = JSON.stringify(await buildBackup(), null, 1);
  const file = await uploadFile({
    name: `respaldo-${today}.json`,
    mimeType: "application/json",
    data: new TextEncoder().encode(json),
    parentId: folder,
  });
  // Una vez al mes también deja la lista de pagos en formato hoja de cálculo.
  if (today.endsWith("-01")) {
    await uploadFile({
      name: `pagos-${today}.csv`,
      mimeType: "text/csv",
      data: new TextEncoder().encode(await buildPaymentsCsv()),
      parentId: folder,
    });
  }
  await setSettings({ last_backup_at: new Date().toISOString(), last_backup_url: file.webViewLink ?? "" });
  return { url: file.webViewLink ?? null };
}
