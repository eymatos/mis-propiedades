"use server";

import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { charges, documents, leases, payments, properties, tenants, units } from "@/lib/db/schema";
import { ensureCharges } from "@/lib/billing";
import { isValidISODate, todayISO } from "@/lib/dates";
import { toMoneyString, toNumber } from "@/lib/money";
import { archiveReceipt } from "@/lib/receipt";
import { nextReceiptNumber, setSettings, DEFAULT_TEMPLATES } from "@/lib/settings";
import { backupToDrive } from "@/lib/backup";

// ---------- utilidades ----------

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
function opt(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v ? v : null;
}
function int(fd: FormData, key: string, fallback = 0): number {
  const n = parseInt(str(fd, key), 10);
  return Number.isFinite(n) ? n : fallback;
}
function money(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  if (!v) return null;
  const n = toNumber(v);
  return n >= 0 ? toMoneyString(n) : null;
}
function dateOrNull(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v && isValidISODate(v) ? v : null;
}
function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}
function done(path: string, message?: string): never {
  revalidatePath("/", "layout");
  if (!message) redirect(path);
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}ok=${encodeURIComponent(message ?? "")}`);
}

// ---------- propiedades y unidades ----------

export async function saveProperty(fd: FormData) {
  const id = int(fd, "id");
  const name = str(fd, "name");
  if (!name) fail(id ? `/propiedades/${id}` : "/propiedades", "Escribe el nombre de la propiedad.");
  const values = {
    name,
    type: str(fd, "type") || "edificio",
    address: opt(fd, "address"),
    notes: opt(fd, "notes"),
  };
  const db = getDb();
  if (id) {
    await db.update(properties).set(values).where(eq(properties.id, id));
    done(`/propiedades/${id}`, "Propiedad actualizada.");
  }
  const [row] = await db.insert(properties).values(values).returning({ id: properties.id });
  // Una casa o local suelto se alquila completo: se crea su unidad única.
  if (str(fd, "single") === "1") {
    await db.insert(units).values({ propertyId: row.id, name: "Completo", type: values.type === "local" ? "local" : "casa" });
  }
  done(`/propiedades/${row.id}`, "Propiedad creada. Ahora agrega sus unidades.");
}

export async function deleteProperty(fd: FormData) {
  const id = int(fd, "id");
  const db = getDb();
  const us = await db.select({ id: units.id }).from(units).where(eq(units.propertyId, id));
  if (us.length) {
    const ls = await db.select({ id: leases.id }).from(leases).where(inArray(leases.unitId, us.map((u) => u.id)));
    if (ls.length) fail(`/propiedades/${id}`, "No se puede borrar: tiene contratos registrados. Finaliza los contratos o bórralos primero.");
  }
  await db.delete(properties).where(eq(properties.id, id));
  done("/propiedades", "Propiedad eliminada.");
}

export async function saveUnit(fd: FormData) {
  const id = int(fd, "id");
  const propertyId = int(fd, "propertyId");
  const name = str(fd, "name");
  const back = `/propiedades/${propertyId}`;
  if (!name) fail(back, "Escribe el nombre de la unidad (ej. Apto 2B, Local 3).");
  const values = {
    name,
    type: str(fd, "type") || "apartamento",
    suggestedRent: money(fd, "suggestedRent"),
    notes: opt(fd, "notes"),
  };
  const db = getDb();
  if (id) await db.update(units).set(values).where(eq(units.id, id));
  else await db.insert(units).values({ ...values, propertyId });
  done(back, id ? "Unidad actualizada." : "Unidad agregada.");
}

export async function deleteUnit(fd: FormData) {
  const id = int(fd, "id");
  const propertyId = int(fd, "propertyId");
  const db = getDb();
  const ls = await db.select({ id: leases.id }).from(leases).where(eq(leases.unitId, id));
  if (ls.length) fail(`/propiedades/${propertyId}`, "No se puede borrar una unidad con contratos registrados.");
  await db.delete(units).where(eq(units.id, id));
  done(`/propiedades/${propertyId}`, "Unidad eliminada.");
}

// ---------- inquilinos ----------

export async function saveTenant(fd: FormData) {
  const id = int(fd, "id");
  const fullName = str(fd, "fullName");
  if (!fullName) fail(id ? `/inquilinos/${id}` : "/inquilinos", "Escribe el nombre del inquilino.");
  const values = {
    fullName,
    idNumber: opt(fd, "idNumber"),
    phone: opt(fd, "phone"),
    email: opt(fd, "email"),
    notes: opt(fd, "notes"),
  };
  const db = getDb();
  if (id) {
    await db.update(tenants).set(values).where(eq(tenants.id, id));
    done(`/inquilinos/${id}`, "Datos del inquilino actualizados.");
  }
  const [row] = await db.insert(tenants).values(values).returning({ id: tenants.id });
  const next = str(fd, "next");
  if (next === "contrato") done(`/contratos/nuevo?inquilino=${row.id}${str(fd, "unidad") ? `&unidad=${str(fd, "unidad")}` : ""}`);
  done(`/inquilinos/${row.id}`, "Inquilino registrado.");
}

export async function deleteTenant(fd: FormData) {
  const id = int(fd, "id");
  const db = getDb();
  const ls = await db.select({ id: leases.id }).from(leases).where(eq(leases.tenantId, id));
  if (ls.length) fail(`/inquilinos/${id}`, "No se puede borrar: tiene contratos registrados.");
  await db.delete(tenants).where(eq(tenants.id, id));
  done("/inquilinos", "Inquilino eliminado.");
}

// ---------- contratos ----------

export async function saveLease(fd: FormData) {
  const id = int(fd, "id");
  const back = id ? `/contratos/${id}` : `/contratos/nuevo?unidad=${str(fd, "unitId")}&inquilino=${str(fd, "tenantId")}`;
  const unitId = int(fd, "unitId");
  const tenantId = int(fd, "tenantId");
  const startDate = dateOrNull(fd, "startDate");
  const endDate = dateOrNull(fd, "endDate");
  const monthlyRent = money(fd, "monthlyRent");
  const paymentDay = Math.min(Math.max(int(fd, "paymentDay", 1), 1), 31);
  if (!unitId || !tenantId) fail(back, "Elige la unidad y el inquilino.");
  if (!startDate) fail(back, "Indica la fecha de inicio del contrato.");
  if (!monthlyRent || toNumber(monthlyRent) <= 0) fail(back, "Indica el monto del alquiler mensual.");
  if (endDate && endDate < startDate) fail(back, "La fecha de fin no puede ser anterior al inicio.");

  const values = {
    unitId,
    tenantId,
    startDate,
    endDate,
    monthlyRent,
    paymentDay,
    billingFrom: /^\d{4}-\d{2}$/.test(str(fd, "billingFrom")) ? str(fd, "billingFrom") : null,
    graceDays: Math.max(int(fd, "graceDays", 5), 0),
    deposit: money(fd, "deposit"),
    notes: opt(fd, "notes"),
  };
  const db = getDb();
  if (id) {
    await db.update(leases).set(values).where(eq(leases.id, id));
    // Las cuotas futuras sin pagos toman el nuevo monto y día de pago.
    if (str(fd, "applyFuture") === "1") {
      const today = todayISO();
      const paidIds = db.select({ id: payments.chargeId }).from(payments);
      await db
        .update(charges)
        .set({ amount: monthlyRent })
        .where(
          and(
            eq(charges.leaseId, id),
            sql`${charges.period} is not null`,
            sql`${charges.dueDate} >= ${today}`,
            notInArray(charges.id, paidIds),
          ),
        );
    }
    await ensureCharges();
    done(`/contratos/${id}`, "Contrato actualizado.");
  }
  const busy = await db
    .select({ id: leases.id })
    .from(leases)
    .where(and(eq(leases.unitId, unitId), eq(leases.active, true)));
  if (busy.length && str(fd, "force") !== "1") {
    fail(back, "Esa unidad ya tiene un contrato activo. Finalízalo primero o marca la casilla para registrarlo igual.");
  }
  const [row] = await db.insert(leases).values(values).returning({ id: leases.id });
  await ensureCharges();
  done(`/contratos/${row.id}`, "Contrato creado. Las cuotas mensuales se generaron solas.");
}

export async function endLease(fd: FormData) {
  const id = int(fd, "id");
  const endDate = dateOrNull(fd, "endDate") ?? todayISO();
  await getDb().update(leases).set({ active: false, endDate }).where(eq(leases.id, id));
  done(`/contratos/${id}`, "Contrato finalizado. Las deudas pendientes siguen visibles.");
}

export async function reactivateLease(fd: FormData) {
  const id = int(fd, "id");
  await getDb().update(leases).set({ active: true }).where(eq(leases.id, id));
  await ensureCharges();
  done(`/contratos/${id}`, "Contrato reactivado.");
}

export async function deleteLease(fd: FormData) {
  const id = int(fd, "id");
  const db = getDb();
  const [l] = await db.select().from(leases).where(eq(leases.id, id));
  if (!l) done("/");
  const cs = await db.select({ id: charges.id }).from(charges).where(eq(charges.leaseId, id));
  if (cs.length) {
    const ps = await db.select({ id: payments.id }).from(payments).where(inArray(payments.chargeId, cs.map((c) => c.id)));
    if (ps.length) fail(`/contratos/${id}`, "Este contrato tiene pagos registrados. Finalízalo en lugar de borrarlo.");
  }
  await db.delete(leases).where(eq(leases.id, id));
  done(`/inquilinos/${l.tenantId}`, "Contrato eliminado.");
}

// ---------- cuotas y pagos ----------

export async function addExtraCharge(fd: FormData) {
  const leaseId = int(fd, "leaseId");
  const back = `/contratos/${leaseId}`;
  const concept = str(fd, "concept");
  const amount = money(fd, "amount");
  const dueDate = dateOrNull(fd, "dueDate");
  if (!concept || !amount || !dueDate) fail(back, "Completa concepto, monto y fecha del cargo.");
  await getDb().insert(charges).values({ leaseId, concept, amount, dueDate, period: null, notes: opt(fd, "notes") });
  done(back, "Cargo agregado.");
}

export async function updateCharge(fd: FormData) {
  const id = int(fd, "id");
  const amount = money(fd, "amount");
  const dueDate = dateOrNull(fd, "dueDate");
  if (!amount || !dueDate) fail(`/cobros/${id}`, "Indica monto y fecha de vencimiento.");
  await getDb()
    .update(charges)
    .set({ amount, dueDate, notes: opt(fd, "notes") })
    .where(eq(charges.id, id));
  done(`/cobros/${id}`, "Cuota actualizada.");
}

export async function deleteCharge(fd: FormData) {
  const id = int(fd, "id");
  const db = getDb();
  const [c] = await db.select().from(charges).where(eq(charges.id, id));
  if (!c) done("/cobros");
  const ps = await db.select({ id: payments.id }).from(payments).where(eq(payments.chargeId, id));
  if (ps.length) fail(`/cobros/${id}`, "Primero borra los pagos de esta cuota.");
  if (c.period) fail(`/cobros/${id}`, "Las cuotas mensuales no se borran; edita su monto (puede ser 0) si no aplica.");
  await db.delete(charges).where(eq(charges.id, id));
  done(`/contratos/${c.leaseId}`, "Cargo eliminado.");
}

export async function registerPayment(fd: FormData) {
  const chargeId = int(fd, "chargeId");
  const back = `/cobros/${chargeId}`;
  const amount = money(fd, "amount");
  const paidAt = dateOrNull(fd, "paidAt") ?? todayISO();
  if (!amount || toNumber(amount) <= 0) fail(back, "Indica el monto recibido.");
  const db = getDb();
  const receiptNumber = await nextReceiptNumber();
  const [p] = await db
    .insert(payments)
    .values({
      chargeId,
      amount,
      paidAt,
      method: str(fd, "method") || "efectivo",
      reference: opt(fd, "reference"),
      notes: opt(fd, "notes"),
      receiptNumber,
    })
    .returning({ id: payments.id });

  let driveOk = true;
  try {
    await archiveReceipt(p.id);
  } catch (e) {
    console.error("No se pudo guardar el recibo en Drive:", e);
    driveOk = false;
  }
  revalidatePath("/", "layout");
  redirect(`${back}?pago=${p.id}${driveOk ? "" : "&drive=error"}`);
}

export async function retryReceiptArchive(fd: FormData) {
  const paymentId = int(fd, "paymentId");
  const chargeId = int(fd, "chargeId");
  try {
    await archiveReceipt(paymentId);
  } catch (e) {
    fail(`/cobros/${chargeId}`, `No se pudo guardar en Drive: ${(e as Error).message.slice(0, 160)}`);
  }
  done(`/cobros/${chargeId}`, "Recibo guardado en Drive.");
}

export async function deletePayment(fd: FormData) {
  const id = int(fd, "id");
  const chargeId = int(fd, "chargeId");
  await getDb().delete(payments).where(eq(payments.id, id));
  done(`/cobros/${chargeId}`, "Pago eliminado. El recibo en Drive no se borra.");
}

// ---------- documentos ----------

export async function deleteDocument(fd: FormData) {
  const id = int(fd, "id");
  const back = str(fd, "back") || "/documentos";
  await getDb().delete(documents).where(eq(documents.id, id));
  done(back, "Documento quitado de la lista. El archivo sigue en tu Google Drive.");
}

// ---------- ajustes ----------

export async function saveSettingsAction(fd: FormData) {
  const keys = ["owner_name", "owner_id", "owner_phone", "owner_address", "reminder_days", "receipt_next", ...Object.keys(DEFAULT_TEMPLATES)];
  const values: Record<string, string> = {};
  for (const k of keys) {
    const v = str(fd, k);
    if (k.startsWith("tpl_")) values[k] = v || DEFAULT_TEMPLATES[k as keyof typeof DEFAULT_TEMPLATES];
    else if (k === "reminder_days" || k === "receipt_next") values[k] = String(Math.max(int(fd, k, k === "reminder_days" ? 5 : 1), k === "receipt_next" ? 1 : 0));
    else values[k] = v;
  }
  await setSettings(values);
  done("/ajustes", "Ajustes guardados.");
}

export async function backupNow() {
  try {
    await backupToDrive();
  } catch (e) {
    fail("/ajustes", `No se pudo respaldar en Drive: ${(e as Error).message.slice(0, 160)}`);
  }
  done("/ajustes", "Respaldo guardado en tu Google Drive.");
}
