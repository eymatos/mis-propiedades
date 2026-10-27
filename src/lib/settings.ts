import { eq, inArray } from "drizzle-orm";
import { getDb } from "./db";
import { appSettings } from "./db/schema";

export const DEFAULT_TEMPLATES = {
  tpl_recordatorio:
    "Hola {nombre}, le recordamos que su pago de {concepto} por {monto} ({inmueble}) vence el {vence}. Gracias.",
  tpl_atraso:
    "Hola {nombre}, su pago de {concepto} ({inmueble}) venció el {vence} y lleva {dias} días de atraso. Monto pendiente: {pendiente}. Por favor, póngase al día lo antes posible. Gracias.",
  tpl_confirmacion:
    "Hola {nombre}, confirmamos que recibimos su pago de {monto} por {concepto} ({inmueble}). Recibo No. {recibo}. Gracias.",
};

export const SETTING_DEFAULTS: Record<string, string> = {
  owner_name: "",
  owner_id: "",
  owner_phone: "",
  owner_address: "",
  reminder_days: "5",
  receipt_next: "1",
  ...DEFAULT_TEMPLATES,
};

export type Settings = Record<string, string>;

export async function getSettings(): Promise<Settings> {
  const rows = await getDb().select().from(appSettings);
  const out: Settings = { ...SETTING_DEFAULTS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function getSetting(key: string): Promise<string | undefined> {
  const [row] = await getDb().select().from(appSettings).where(eq(appSettings.key, key));
  return row?.value ?? SETTING_DEFAULTS[key];
}

export async function setSettings(values: Record<string, string>) {
  const db = getDb();
  for (const [key, value] of Object.entries(values)) {
    await db
      .insert(appSettings)
      .values({ key, value })
      .onConflictDoUpdate({ target: appSettings.key, set: { value } });
  }
}

export async function deleteSettings(keys: string[]) {
  if (keys.length) await getDb().delete(appSettings).where(inArray(appSettings.key, keys));
}

/** Toma el siguiente número de recibo y lo incrementa. */
export async function nextReceiptNumber(): Promise<number> {
  const current = Number((await getSetting("receipt_next")) ?? "1") || 1;
  await setSettings({ receipt_next: String(current + 1) });
  return current;
}
