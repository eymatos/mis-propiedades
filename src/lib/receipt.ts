import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { payments, tenants, leases } from "./db/schema";
import { loadCharges, type ChargeView } from "./billing";
import { formatDateLong, formatDate } from "./dates";
import { formatDOP, montoEnLetras, toNumber } from "./money";
import { getSettings } from "./settings";

// Las fuentes estándar de PDF solo aceptan Latin-1: quitamos lo demás.
function clean(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFC")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

const METODOS: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  deposito: "Depósito bancario",
  cheque: "Cheque",
  otro: "Otro",
};

export function methodLabel(m: string): string {
  return METODOS[m] ?? m;
}

export function receiptNo(n: number | null | undefined): string {
  return n ? String(n).padStart(6, "0") : "—";
}

type ReceiptData = {
  payment: typeof payments.$inferSelect;
  charge: ChargeView;
  tenantIdNumber: string | null;
};

export async function getReceiptData(paymentId: number): Promise<ReceiptData | null> {
  const db = getDb();
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId));
  if (!payment) return null;
  const [charge] = await loadCharges({ chargeId: payment.chargeId });
  if (!charge) return null;
  const [t] = await db
    .select({ idNumber: tenants.idNumber })
    .from(leases)
    .innerJoin(tenants, eq(leases.tenantId, tenants.id))
    .where(eq(leases.id, charge.leaseId));
  return { payment, charge, tenantIdNumber: t?.idNumber ?? null };
}

export async function buildReceiptPdf(data: ReceiptData): Promise<Uint8Array> {
  const s = await getSettings();
  const { payment, charge } = data;
  const doc = await PDFDocument.create();
  doc.setTitle(`Recibo ${receiptNo(payment.receiptNumber)}`);
  const page = doc.addPage([612, 396]); // media carta horizontal
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.09, 0.15, 0.13);
  const muted = rgb(0.38, 0.45, 0.42);
  const accent = rgb(0.05, 0.43, 0.43);

  const text = (p: PDFPage, t: string, x: number, y: number, size: number, font: PDFFont, color = ink) =>
    p.drawText(clean(t), { x, y, size, font, color });

  // Encabezado
  page.drawRectangle({ x: 0, y: 380, width: 612, height: 16, color: accent });
  text(page, s.owner_name || "Recibo de pago", 36, 346, 15, bold);
  const ownerLine = [s.owner_id && `RNC/Cédula: ${s.owner_id}`, s.owner_phone && `Tel.: ${s.owner_phone}`]
    .filter(Boolean)
    .join("   ");
  if (ownerLine) text(page, ownerLine, 36, 330, 9, regular, muted);
  if (s.owner_address) text(page, s.owner_address, 36, 318, 9, regular, muted);

  text(page, "RECIBO DE PAGO", 400, 346, 12, bold, accent);
  text(page, `No. ${receiptNo(payment.receiptNumber)}`, 400, 330, 11, bold);
  text(page, `Fecha: ${formatDate(payment.paidAt)}`, 400, 316, 9, regular, muted);

  page.drawLine({ start: { x: 36, y: 302 }, end: { x: 576, y: 302 }, thickness: 0.6, color: muted });

  // Cuerpo
  let y = 278;
  const row = (label: string, value: string, size = 11) => {
    text(page, label, 36, y, 9, regular, muted);
    text(page, value, 150, y, size, regular);
    y -= 22;
  };
  const amount = toNumber(payment.amount);
  row("Recibimos de", `${charge.tenant.fullName}${data.tenantIdNumber ? `  (Céd./RNC ${data.tenantIdNumber})` : ""}`);
  text(page, "La suma de", 36, y, 9, regular, muted);
  text(page, formatDOP(amount), 150, y, 14, bold);
  y -= 16;
  text(page, montoEnLetras(amount), 150, y, 8, regular, muted);
  y -= 22;
  row("Por concepto de", `${charge.label} - ${charge.unit.name}, ${charge.property.name}`);
  row("Forma de pago", `${methodLabel(payment.method)}${payment.reference ? `  ·  Ref. ${payment.reference}` : ""}`);
  row(
    "Balance de la cuota",
    charge.balance > 0 ? `Pendiente ${formatDOP(charge.balance)} de ${formatDOP(charge.amount)}` : "Saldada",
  );
  if (payment.notes) row("Nota", payment.notes, 9);

  // Firma
  page.drawLine({ start: { x: 360, y: 52 }, end: { x: 560, y: 52 }, thickness: 0.6, color: ink });
  text(page, "Recibido por", 430, 40, 9, regular, muted);
  text(page, `Emitido el ${formatDateLong(payment.paidAt)}`, 36, 40, 8, regular, muted);

  return doc.save();
}
