import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { payments } from "@/lib/db/schema";
import { confirmationLink, lateLink, loadCharges, reminderLink, statusText, toneOf } from "@/lib/billing";
import { formatDate, todayISO } from "@/lib/dates";
import { toNumber } from "@/lib/money";
import { methodLabel, receiptNo } from "@/lib/receipt";
import { getSettings } from "@/lib/settings";
import {
  deleteCharge,
  deletePayment,
  registerPayment,
  updateCharge,
} from "@/app/actions";
import { SubmitButton } from "@/components/client";
import {
  btn,
  Collapsible,
  EmptyState,
  Field,
  Flash,
  inputCls,
  KeyValue,
  Money,
  PageHeader,
  Panel,
  Section,
  StatusChip,
  WhatsAppLink,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ChargePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string; pago?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const today = todayISO();
  const [charge] = await loadCharges({ chargeId: Number(id) }, today);
  if (!charge) notFound();

  const [settings, pays] = await Promise.all([
    getSettings(),
    getDb().select().from(payments).where(eq(payments.chargeId, charge.id)).orderBy(desc(payments.paidAt), desc(payments.id)),
  ]);
  const justPaid = sp.pago ? pays.find((p) => p.id === Number(sp.pago)) : undefined;

  return (
    <>
      <PageHeader
        title={charge.label}
        subtitle={
          <>
            <Link href={`/inquilinos/${charge.tenant.id}`} className="font-semibold text-ink hover:text-caribe">
              {charge.tenant.fullName}
            </Link>{" "}
            · {charge.unit.name}, {charge.property.name}
          </>
        }
        back={{ href: `/contratos/${charge.leaseId}`, label: "Contrato" }}
      />
      <Flash ok={sp.ok} error={sp.error} />

      {justPaid && (
        <div className="mb-6 rounded-xl border border-paid/30 bg-paid-soft p-4">
          <p className="font-semibold text-paid">
            Pago de <Money value={toNumber(justPaid.amount)} /> registrado · Recibo No. {receiptNo(justPaid.receiptNumber)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={`/api/recibo/${justPaid.id}`} target="_blank" className={btn.secondary}>
              Ver recibo PDF
            </a>
            <WhatsAppLink
              href={confirmationLink(charge, { amount: toNumber(justPaid.amount), receiptNumber: justPaid.receiptNumber }, settings)}
              label="Confirmar por WhatsApp"
            />
          </div>
        </div>
      )}

      <Panel className="mb-8 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <StatusChip tone={toneOf(charge)}>{statusText(charge)}</StatusChip>
          {charge.status !== "pagado" && (
            <WhatsAppLink
              href={charge.isLate ? lateLink(charge, settings) : reminderLink(charge, settings)}
              label={charge.isLate ? "Avisar atraso" : "Recordar pago"}
            />
          )}
        </div>
        <KeyValue
          items={[
            ["Monto de la cuota", <Money key="a" value={charge.amount} />],
            ["Pagado", <Money key="p" value={charge.paid} className="text-paid" />],
            ["Pendiente", <Money key="b" value={charge.balance} className={charge.balance > 0 ? "text-late" : ""} />],
            ["Vence", `${formatDate(charge.dueDate)} (${charge.graceDays} días de gracia)`],
          ]}
        />
        <div className="mt-4">
          <Collapsible label="Editar cuota" variant="ghost">
            <form action={updateCharge} className="grid gap-3 sm:grid-cols-3 sm:items-end">
              <input type="hidden" name="id" value={charge.id} />
              <Field label="Monto">
                <input name="amount" inputMode="decimal" defaultValue={charge.amount} className={inputCls} required />
              </Field>
              <Field label="Vence">
                <input type="date" name="dueDate" defaultValue={charge.dueDate} className={inputCls} required />
              </Field>
              <SubmitButton>Guardar cuota</SubmitButton>
            </form>
            {!charge.period && pays.length === 0 && (
              <form action={deleteCharge} className="mt-3">
                <input type="hidden" name="id" value={charge.id} />
                <SubmitButton variant="danger" confirm="¿Borrar este cargo?">
                  Borrar cargo
                </SubmitButton>
              </form>
            )}
          </Collapsible>
        </div>
      </Panel>

      {charge.balance > 0 && (
        <Section title="Registrar pago">
          <form id="pago" action={registerPayment} className="grid scroll-mt-20 gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2">
            <input type="hidden" name="chargeId" value={charge.id} />
            <Field label="Monto recibido (RD$)">
              <input name="amount" inputMode="decimal" defaultValue={charge.balance.toFixed(2)} className={`${inputCls} num`} required />
            </Field>
            <Field label="Fecha del pago">
              <input type="date" name="paidAt" defaultValue={today} className={inputCls} required />
            </Field>
            <Field label="Forma de pago">
              <select name="method" defaultValue="transferencia" className={inputCls}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="deposito">Depósito bancario</option>
                <option value="cheque">Cheque</option>
                <option value="otro">Otro</option>
              </select>
            </Field>
            <Field label="Referencia (opcional)" hint="No. de transferencia, cheque o depósito">
              <input name="reference" className={inputCls} />
            </Field>
            <Field label="Nota (opcional)" className="sm:col-span-2">
              <input name="notes" className={inputCls} />
            </Field>
            <div className="sm:col-span-2">
              <SubmitButton pending="Registrando y creando recibo…">Registrar pago y generar recibo</SubmitButton>
            </div>
          </form>
        </Section>
      )}

      <Section title="Pagos de esta cuota">
        {pays.length === 0 ? (
          <EmptyState title="Aún no hay pagos registrados." />
        ) : (
          <Panel className="divide-y divide-line">
            {pays.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <Money value={toNumber(p.amount)} className="font-bold" />
                  <p className="text-sm text-muted">
                    {formatDate(p.paidAt)} · {methodLabel(p.method)}
                    {p.reference ? ` · Ref. ${p.reference}` : ""} · Recibo {receiptNo(p.receiptNumber)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a href={`/api/recibo/${p.id}`} target="_blank" className={btn.ghost}>
                    PDF
                  </a>
                  <form action={deletePayment}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="chargeId" value={charge.id} />
                    <SubmitButton variant="danger" pending="…" confirm="¿Eliminar este pago? Úsalo solo para corregir errores.">
                      Eliminar
                    </SubmitButton>
                  </form>
                </div>
              </div>
            ))}
          </Panel>
        )}
      </Section>
    </>
  );
}
