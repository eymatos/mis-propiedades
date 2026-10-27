import { and, eq, inArray, isNotNull, sql, type SQL } from "drizzle-orm";
import { getDb } from "./db";
import { charges, leases, payments, properties, tenants, units } from "./db/schema";
import { addDays, addMonths, diffDays, dueDateFor, formatDate, periodLabel, todayISO } from "./dates";
import { formatDOP, round2, toNumber } from "./money";
import { fillTemplate, whatsappLink } from "./whatsapp";
import type { Settings } from "./settings";

export type ChargeStatus = "pagado" | "parcial" | "pendiente";

export type ChargeView = {
  id: number;
  leaseId: number;
  period: string | null;
  concept: string;
  label: string;
  dueDate: string;
  amount: number;
  paid: number;
  balance: number;
  status: ChargeStatus;
  isLate: boolean;
  daysLate: number;
  daysToDue: number;
  graceDays: number;
  leaseActive: boolean;
  tenant: { id: number; fullName: string; phone: string | null };
  unit: { id: number; name: string };
  property: { id: number; name: string };
};

/**
 * Crea las cuotas mensuales que falten para cada contrato activo,
 * desde el inicio del contrato hasta el mes que vence en los próximos 10 días.
 */
export async function ensureCharges(today = todayISO()): Promise<number> {
  const db = getDb();
  const active = await db.select().from(leases).where(eq(leases.active, true));
  if (!active.length) return 0;

  const existing = await db
    .select({ leaseId: charges.leaseId, period: charges.period })
    .from(charges)
    .where(and(isNotNull(charges.period), inArray(charges.leaseId, active.map((l) => l.id))));
  const have = new Set(existing.map((e) => `${e.leaseId}:${e.period}`));

  const horizon = addDays(today, 10).slice(0, 7);
  const rows: (typeof charges.$inferInsert)[] = [];

  for (const l of active) {
    let p = l.billingFrom && l.billingFrom > l.startDate.slice(0, 7) ? l.billingFrom : l.startDate.slice(0, 7);
    const last = l.endDate && l.endDate.slice(0, 7) < horizon ? l.endDate.slice(0, 7) : horizon;
    let guard = 0;
    while (p <= last && guard < 600) {
      if (!have.has(`${l.id}:${p}`)) {
        rows.push({
          leaseId: l.id,
          period: p,
          concept: "Alquiler",
          dueDate: dueDateFor(p, l.paymentDay, l.startDate),
          amount: l.monthlyRent,
        });
      }
      p = addMonths(p, 1);
      guard++;
    }
  }

  for (let i = 0; i < rows.length; i += 200) {
    await db.insert(charges).values(rows.slice(i, i + 200)).onConflictDoNothing();
  }
  return rows.length;
}

export type ChargeFilter = {
  leaseId?: number;
  tenantId?: number;
  propertyId?: number;
  chargeId?: number;
  dueFrom?: string;
  dueTo?: string;
};

export async function loadCharges(filter: ChargeFilter = {}, today = todayISO()): Promise<ChargeView[]> {
  const db = getDb();
  const conds: SQL[] = [];
  if (filter.leaseId) conds.push(eq(charges.leaseId, filter.leaseId));
  if (filter.tenantId) conds.push(eq(leases.tenantId, filter.tenantId));
  if (filter.propertyId) conds.push(eq(units.propertyId, filter.propertyId));
  if (filter.chargeId) conds.push(eq(charges.id, filter.chargeId));
  if (filter.dueFrom) conds.push(sql`${charges.dueDate} >= ${filter.dueFrom}`);
  if (filter.dueTo) conds.push(sql`${charges.dueDate} <= ${filter.dueTo}`);

  const paidSub = db
    .select({
      chargeId: payments.chargeId,
      total: sql<string>`coalesce(sum(${payments.amount}), 0)`.as("total"),
    })
    .from(payments)
    .groupBy(payments.chargeId)
    .as("paid");

  const rows = await db
    .select({
      charge: charges,
      paid: paidSub.total,
      lease: { id: leases.id, active: leases.active, graceDays: leases.graceDays },
      tenant: { id: tenants.id, fullName: tenants.fullName, phone: tenants.phone },
      unit: { id: units.id, name: units.name },
      property: { id: properties.id, name: properties.name },
    })
    .from(charges)
    .innerJoin(leases, eq(charges.leaseId, leases.id))
    .innerJoin(tenants, eq(leases.tenantId, tenants.id))
    .innerJoin(units, eq(leases.unitId, units.id))
    .innerJoin(properties, eq(units.propertyId, properties.id))
    .leftJoin(paidSub, eq(paidSub.chargeId, charges.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(charges.dueDate, charges.id);

  return rows.map((r) => {
    const amount = toNumber(r.charge.amount);
    const paid = toNumber(r.paid);
    const balance = round2(Math.max(amount - paid, 0));
    const status: ChargeStatus = balance <= 0 ? "pagado" : paid > 0 ? "parcial" : "pendiente";
    const daysPastDue = diffDays(today, r.charge.dueDate);
    const isLate = status !== "pagado" && daysPastDue > r.lease.graceDays;
    return {
      id: r.charge.id,
      leaseId: r.charge.leaseId,
      period: r.charge.period,
      concept: r.charge.concept,
      label: r.charge.period ? `${r.charge.concept} ${periodLabel(r.charge.period)}` : r.charge.concept,
      dueDate: r.charge.dueDate,
      amount,
      paid,
      balance,
      status,
      isLate,
      daysLate: Math.max(daysPastDue, 0),
      daysToDue: -daysPastDue,
      graceDays: r.lease.graceDays,
      leaseActive: r.lease.active,
      tenant: r.tenant,
      unit: r.unit,
      property: r.property,
    };
  });
}

export function inmuebleLabel(c: Pick<ChargeView, "unit" | "property">): string {
  return `${c.unit.name}, ${c.property.name}`;
}

export function reminderLink(c: ChargeView, settings: Settings): string | null {
  const text = fillTemplate(settings.tpl_recordatorio, {
    nombre: c.tenant.fullName.split(" ")[0],
    concepto: c.label,
    monto: formatDOP(c.balance),
    pendiente: formatDOP(c.balance),
    inmueble: inmuebleLabel(c),
    vence: formatDate(c.dueDate),
    dias: c.daysLate,
  });
  return whatsappLink(c.tenant.phone, text);
}

export function lateLink(c: ChargeView, settings: Settings): string | null {
  const text = fillTemplate(settings.tpl_atraso, {
    nombre: c.tenant.fullName.split(" ")[0],
    concepto: c.label,
    monto: formatDOP(c.amount),
    pendiente: formatDOP(c.balance),
    inmueble: inmuebleLabel(c),
    vence: formatDate(c.dueDate),
    dias: c.daysLate,
  });
  return whatsappLink(c.tenant.phone, text);
}

export function confirmationLink(
  c: ChargeView,
  payment: { amount: number; receiptNumber: number | null },
  settings: Settings,
): string | null {
  const text = fillTemplate(settings.tpl_confirmacion, {
    nombre: c.tenant.fullName.split(" ")[0],
    concepto: c.label,
    monto: formatDOP(payment.amount),
    pendiente: formatDOP(c.balance),
    inmueble: inmuebleLabel(c),
    vence: formatDate(c.dueDate),
    recibo: payment.receiptNumber ? String(payment.receiptNumber).padStart(6, "0") : "—",
  });
  return whatsappLink(c.tenant.phone, text);
}

export function statusText(c: ChargeView): string {
  if (c.status === "pagado") return "Pagado";
  if (c.isLate) return `${c.daysLate} ${c.daysLate === 1 ? "día" : "días"} de atraso`;
  if (c.status === "parcial") return "Pago parcial";
  if (c.daysToDue > 0) return `Vence en ${c.daysToDue} ${c.daysToDue === 1 ? "día" : "días"}`;
  if (c.daysToDue === 0) return "Vence hoy";
  return "En periodo de gracia";
}

export type Tone = "paid" | "late" | "due" | "neutral";

export function toneOf(c: ChargeView): Tone {
  if (c.status === "pagado") return "paid";
  if (c.isLate) return "late";
  if (c.daysToDue <= 7) return "due";
  return "neutral";
}
