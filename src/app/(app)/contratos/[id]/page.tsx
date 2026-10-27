import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { documents, leases, properties, tenants, units } from "@/lib/db/schema";
import { loadCharges } from "@/lib/billing";
import { formatDate, periodLabel, todayISO } from "@/lib/dates";
import { round2, toNumber } from "@/lib/money";
import { addExtraCharge, deleteLease, endLease, reactivateLease } from "@/app/actions";
import { SubmitButton } from "@/components/client";
import { DocumentUpload } from "@/components/document-upload";
import { LeaseForm } from "@/components/forms";
import { ChargeList, DocumentList } from "@/components/lists";
import { Collapsible, Field, Flash, inputCls, KeyValue, Money, PageHeader, Panel, Pill, Section } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LeasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const db = getDb();
  const today = todayISO();
  const [row] = await db
    .select({ lease: leases, tenant: tenants, unitName: units.name, propertyName: properties.name, propertyId: properties.id })
    .from(leases)
    .innerJoin(tenants, eq(leases.tenantId, tenants.id))
    .innerJoin(units, eq(leases.unitId, units.id))
    .innerJoin(properties, eq(units.propertyId, properties.id))
    .where(eq(leases.id, id));
  if (!row) notFound();
  const { lease, tenant } = row;

  const [charges, docs, unitRows, tenantRows] = await Promise.all([
    loadCharges({ leaseId: id }, today),
    db.select().from(documents).where(eq(documents.leaseId, id)).orderBy(desc(documents.createdAt)),
    db
      .select({ id: units.id, name: units.name, suggestedRent: units.suggestedRent, propertyName: properties.name })
      .from(units)
      .innerJoin(properties, eq(units.propertyId, properties.id))
      .orderBy(properties.name, units.name),
    db.select({ id: tenants.id, fullName: tenants.fullName }).from(tenants).orderBy(tenants.fullName),
  ]);
  const owed = round2(charges.reduce((s, c) => s + c.balance, 0));
  const paid = round2(charges.reduce((s, c) => s + c.paid, 0));

  return (
    <>
      <PageHeader
        title={`${row.unitName}, ${row.propertyName}`}
        subtitle={
          <>
            Contrato de{" "}
            <Link href={`/inquilinos/${tenant.id}`} className="font-semibold text-ink hover:text-caribe">
              {tenant.fullName}
            </Link>{" "}
            {lease.active ? <Pill>Activo</Pill> : <Pill>Finalizado</Pill>}
          </>
        }
        back={{ href: `/inquilinos/${tenant.id}`, label: tenant.fullName }}
      />
      <Flash ok={sp.ok} error={sp.error} />

      <Panel className="mb-8 p-4">
        <KeyValue
          items={[
            ["Alquiler mensual", <Money key="r" value={toNumber(lease.monthlyRent)} />],
            ["Día de pago", `Día ${lease.paymentDay} de cada mes · ${lease.graceDays} días de gracia`],
            ["Vigencia", `${formatDate(lease.startDate)} – ${lease.endDate ? formatDate(lease.endDate) : "indefinido"}`],
            ["Depósito", lease.deposit ? <Money key="d" value={toNumber(lease.deposit)} /> : "—"],
            ["Cuotas registradas desde", lease.billingFrom ? periodLabel(lease.billingFrom) : periodLabel(lease.startDate.slice(0, 7))],
            ["Total cobrado / pendiente", <span key="t"><Money value={paid} className="text-paid" /> / <Money value={owed} className={owed > 0 ? "text-late" : ""} /></span>],
          ]}
        />
        {lease.notes && <p className="mt-4 whitespace-pre-line text-sm text-muted">{lease.notes}</p>}
      </Panel>

      <Section title="Cuotas y cargos">
        <div className="mb-3">
          <ChargeList items={[...charges].reverse()} showTenant={false} empty="Todavía no hay cuotas generadas." />
        </div>
        <Collapsible label="Agregar cargo extra">
          <form action={addExtraCharge} className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-3 sm:items-end">
            <input type="hidden" name="leaseId" value={id} />
            <Field label="Concepto">
              <input name="concept" required placeholder="Mantenimiento, agua, mora…" className={inputCls} />
            </Field>
            <Field label="Monto (RD$)">
              <input name="amount" required inputMode="decimal" className={`${inputCls} num`} />
            </Field>
            <Field label="Vence">
              <input type="date" name="dueDate" required defaultValue={today} className={inputCls} />
            </Field>
            <div className="sm:col-span-3">
              <SubmitButton>Agregar cargo</SubmitButton>
            </div>
          </form>
        </Collapsible>
      </Section>

      <Section title="Documentos del contrato">
        <div className="mb-3">
          <DocumentList docs={docs} back={`/contratos/${id}`} />
        </div>
        <Collapsible label="Subir contrato firmado u otro documento">
          <DocumentUpload target={{ leaseId: id, tenantId: tenant.id }} defaultCategory="contrato" />
        </Collapsible>
      </Section>

      <Section title="Modificar contrato">
        <div className="grid gap-3">
          <Collapsible label="Editar condiciones">
            <LeaseForm
              lease={lease}
              unitOptions={unitRows.map((u) => ({ ...u, occupied: false }))}
              tenantOptions={tenantRows}
              today={today}
            />
          </Collapsible>
          {lease.active ? (
            <Collapsible label="Finalizar contrato">
              <form action={endLease} className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <input type="hidden" name="id" value={id} />
                <Field label="Fecha de salida" hint="No se generarán más cuotas. Las deudas siguen visibles.">
                  <input type="date" name="endDate" defaultValue={today} className={inputCls} />
                </Field>
                <SubmitButton variant="secondary" confirm="¿Finalizar este contrato?">
                  Finalizar contrato
                </SubmitButton>
              </form>
            </Collapsible>
          ) : (
            <form action={reactivateLease}>
              <input type="hidden" name="id" value={id} />
              <SubmitButton variant="secondary">Reactivar contrato</SubmitButton>
            </form>
          )}
          {charges.every((c) => c.paid === 0) && (
            <form action={deleteLease}>
              <input type="hidden" name="id" value={id} />
              <SubmitButton variant="danger" confirm="¿Borrar este contrato y sus cuotas? Solo para corregir errores.">
                Borrar contrato
              </SubmitButton>
            </form>
          )}
        </div>
      </Section>
    </>
  );
}
