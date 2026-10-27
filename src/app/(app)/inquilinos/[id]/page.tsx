import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, or, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { documents, leases, properties, tenants, units } from "@/lib/db/schema";
import { loadCharges } from "@/lib/billing";
import { formatDate } from "@/lib/dates";
import { round2, toNumber } from "@/lib/money";
import { whatsappLink } from "@/lib/whatsapp";
import { deleteTenant } from "@/app/actions";
import { SubmitButton } from "@/components/client";
import { DocumentUpload } from "@/components/document-upload";
import { TenantForm } from "@/components/forms";
import { ChargeList, DocumentList } from "@/components/lists";
import { btn, Collapsible, EmptyState, Flash, KeyValue, Money, PageHeader, Panel, Pill, Section, WhatsAppLink } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TenantPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const db = getDb();
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
  if (!tenant) notFound();

  const leaseRows = await db
    .select({ lease: leases, unitName: units.name, propertyName: properties.name, propertyId: properties.id })
    .from(leases)
    .innerJoin(units, eq(leases.unitId, units.id))
    .innerJoin(properties, eq(units.propertyId, properties.id))
    .where(eq(leases.tenantId, id))
    .orderBy(desc(leases.active), desc(leases.startDate));
  const leaseIds = leaseRows.map((l) => l.lease.id);

  const [charges, docs] = await Promise.all([
    loadCharges({ tenantId: id }),
    db
      .select()
      .from(documents)
      .where(leaseIds.length ? or(eq(documents.tenantId, id), inArray(documents.leaseId, leaseIds)) : eq(documents.tenantId, id))
      .orderBy(desc(documents.createdAt)),
  ]);
  const open = charges.filter((c) => c.status !== "pagado").reverse();
  const history = charges.filter((c) => c.status === "pagado").reverse().slice(0, 12);
  const owed = round2(open.reduce((s, c) => s + c.balance, 0));
  const lateOwed = round2(open.filter((c) => c.isLate).reduce((s, c) => s + c.balance, 0));

  return (
    <>
      <PageHeader
        title={tenant.fullName}
        subtitle={tenant.idNumber ? `Cédula/RNC ${tenant.idNumber}` : undefined}
        back={{ href: "/inquilinos", label: "Inquilinos" }}
        actions={
          <>
            <WhatsAppLink href={whatsappLink(tenant.phone, `Hola ${tenant.fullName.split(" ")[0]}, `)} label="Escribir" />
            <Link href={`/contratos/nuevo?inquilino=${id}`} className={btn.secondary}>
              Nuevo contrato
            </Link>
          </>
        }
      />
      <Flash ok={sp.ok} error={sp.error} />

      <Panel className="mb-8 grid grid-cols-2 divide-x divide-line">
        <div className="p-4">
          <p className="text-sm text-muted">Balance pendiente</p>
          <Money value={owed} className="text-xl font-bold" />
        </div>
        <div className="p-4">
          <p className="text-sm text-muted">De eso, atrasado</p>
          <Money value={lateOwed} className={`text-xl font-bold ${lateOwed > 0 ? "text-late" : ""}`} />
        </div>
      </Panel>

      <Section title="Contratos">
        {leaseRows.length === 0 ? (
          <EmptyState title="Este inquilino no tiene contratos.">
            <Link href={`/contratos/nuevo?inquilino=${id}`} className={btn.ghost}>
              Crear contrato
            </Link>
          </EmptyState>
        ) : (
          <Panel className="divide-y divide-line">
            {leaseRows.map(({ lease, unitName, propertyName }) => (
              <Link key={lease.id} href={`/contratos/${lease.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-mist/60">
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {unitName}, {propertyName}
                  </p>
                  <p className="text-sm text-muted">
                    Desde {formatDate(lease.startDate)}
                    {lease.endDate ? ` hasta ${formatDate(lease.endDate)}` : ""} · día {lease.paymentDay}
                  </p>
                </div>
                <div className="text-right">
                  <Money value={toNumber(lease.monthlyRent)} className="font-bold" />
                  <div>{lease.active ? <Pill>Activo</Pill> : <Pill>Finalizado</Pill>}</div>
                </div>
              </Link>
            ))}
          </Panel>
        )}
      </Section>

      <Section title="Cuotas pendientes">
        <ChargeList items={open} showTenant={false} empty="No debe nada." />
      </Section>

      {history.length > 0 && (
        <Section title="Últimas cuotas pagadas">
          <ChargeList items={history} showTenant={false} />
        </Section>
      )}

      <Section title="Documentos">
        <div className="mb-3">
          <DocumentList docs={docs} back={`/inquilinos/${id}`} />
        </div>
        <Collapsible label="Subir documento">
          <DocumentUpload target={{ tenantId: id }} defaultCategory="identificacion" />
        </Collapsible>
      </Section>

      <Section title="Datos de contacto">
        <Panel className="mb-3 p-4">
          <KeyValue
            items={[
              ["Teléfono", tenant.phone],
              ["Correo", tenant.email],
              ["Cédula / RNC", tenant.idNumber],
              ["Notas", tenant.notes],
            ]}
          />
        </Panel>
        <Collapsible label="Editar datos">
          <TenantForm tenant={tenant} />
          <form action={deleteTenant} className="mt-3">
            <input type="hidden" name="id" value={id} />
            <SubmitButton variant="danger" confirm="¿Borrar este inquilino? No se puede deshacer.">
              Borrar inquilino
            </SubmitButton>
          </form>
        </Collapsible>
      </Section>
    </>
  );
}
