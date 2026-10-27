// Fechas como texto "YYYY-MM-DD" y periodos "YYYY-MM", siempre en hora de República Dominicana.
export const TZ = "America/Santo_Domingo";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function currentPeriod(): string {
  return todayISO().slice(0, 7);
}

function toUTC(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = toUTC(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUTC(d);
}

/** Días entre a y b (a - b). */
export function diffDays(a: string, b: string): number {
  return Math.round((toUTC(a).getTime() - toUTC(b).getTime()) / 86_400_000);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addMonths(period: string, n: number): string {
  const [y, m] = period.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/** Fecha de vencimiento de un periodo según el día de pago del contrato. */
export function dueDateFor(period: string, paymentDay: number, leaseStart?: string): string {
  const [y, m] = period.split("-").map(Number);
  const day = Math.min(Math.max(paymentDay, 1), daysInMonth(y, m));
  const due = `${period}-${String(day).padStart(2, "0")}`;
  if (leaseStart && due < leaseStart) return leaseStart;
  return due;
}

export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const name = MESES[m - 1] ?? "";
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateLong(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

export function isValidISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(toUTC(value).getTime());
}
