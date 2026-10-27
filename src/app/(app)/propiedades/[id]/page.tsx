import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { documents, leases, properties, tenants, units, type Lease } from "@/lib/db/schema";
import { loadCharges } from "@/lib/billing";
import { formatDate } from "@/lib/dates";
import { round2, toNumber } from "@/lib/money";
import { deleteProperty, deleteUnit } from "@/app/actions";
import { SubmitButton } from "@/components/client";
import { DocumentUpload } from "@/components/document-upload";
import { PROPERTY_TYPES, PropertyForm, UNIT_TYPES, UnitForm, label } from "@/components/forms";
import { DocumentList } from "@/components/lists";
import { btn, Collapsible, EmptyState, Flash, Money, PageHeader, Panel, Pill, Section } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const db = getDb();
  const [property] = await db.select().from(properties).where(eq(properties.id, id));
  if (!property) notFound();

  const unitRows = await db.select().from(units).where(eq(units.propertyId, id)).orderBy(units.name);
  const unitIds = unitRows.map((u) => u.id);
  const [activeLeases, docs, charges] = await Promise.all([
    unitIds.length
      ? db
          .select({ lease: leases, tenantName: tenants.fullName })
          .from(leases)
          .innerJoin(tenants, eq(leases.tenantId, tenants.id))
          .where(and(inArray(leases.unitId, unitIds), eq(leases.active, true)))
      : Promise.resolve([] as { lease: Lease; tenantName: string }[]),
    db.select().from(documents).where(eq(documents.propertyId, id)).orderBy(desc(documents.createdAt)),
    loadCharges({ propertyId: id }),
  ]);

  const debt = round2(charges.filter((c) => c.isLate).reduce((s, c) => s + c.balance, 0));
  const monthlyIncome = round2(activeLeases.reduce((s, l) => s + toNumber(l.lease.monthlyRent), 0));

  return (
    <>
      <PageHeader
        title={property.name}
        subtitle={[label(PROPERTY_TYPES, property.type), property.address].filter(Boolean).join(" · ")}
        back={{ href: "/propiedades", label: "Propiedades" }}
      />
      <Flash ok={sp.ok} error={sp.error} />

      <Panel className="mb-8 grid grid-cols-2 divide-x divide-line">
        <div className="p-4">
          <p className="text-sm text-muted">Renta mensual activa</p>
          <Money value={monthlyIncome} className="text-xl font-bold" />
        </div>
        <div className="p-4">
          <p className="text-sm text-muted">Deuda atrasada</p>
          <Money value={debt} className={`text-xl font-bold ${debt > 0 ? "text-late" : ""}`} />
        </div>
      </Panel>

      <Section title="Unidades" aside={<span className="text-sm text-muted">{unitRows.length}</span>}>
        {unitRows.length === 0 ? (
          <EmptyState title="Agrega los apartamentos, locales u oficinas de esta propiedad." />
        ) : (
          <Panel className="mb-3 divide-y divide-line">
            {unitRows.map((u) => {
              const l = activeLeases.find((x) => x.lease.unitId === u.id);
              return (
                <div key={u.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {u.name} <Pill>{label(UNIT_TYPES, u.type)}</Pill>
                      </p>
                      {l ? (
                        <p className="text-sm text-muted">
                          <Link href={`/contratos/${l.lease.id}`} className="font-semibold text-ink hover:text-caribe">
                            {l.tenantName}
                          </Link>{" "}
                          · <Money value={toNumber(l.lease.monthlyRent)} /> · paga el día {l.lease.paymentDay}
                          {l.lease.endDate ? ` · hasta ${formatDate(l.lease.endDate)}` : ""}
                        </p>
                      ) : (
                        <p className="text-sm font-semibold text-paid">
                          Disponible{u.suggestedRent ? <> · <Money value={toNumber(u.suggestedRent)} /></> : null}
                        </p>
                      )}
                    </div>
                    {!l && (
                      <Link href={`/contratos/nuevo?unidad=${u.id}`} className={btn.secondary}>
                        Alquilar
                      </Link>
                    )}
                  </div>
                  <div className="mt-2">
                    <Collapsible label="Editar" variant="ghost">
                      <UnitForm propertyId={id} unit={u} />
                      <form action={deleteUnit} className="mt-2">
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="propertyId" value={id} />
                        <SubmitButton variant="danger" confirm={`¿Borrar la unidad ${u.name}?`}>
                          Borrar unidad
                        </SubmitButton>
                      </form>
                    </Collapsible>
                  </div>
                </div>
              );
            })}
          </Panel>
        )}
        <div className="mt-3">
          <Collapsible label="Agregar unidad" variant="primary" open={unitRows.length === 0}>
            <UnitForm propertyId={id} />
          </Collapsible>
        </div>
      </Section>

      <Section title="Documentos de la propiedad">
        <div className="mb-3">
          <DocumentList docs={docs} back={`/propiedades/${id}`} />
        </div>
        <Collapsible label="Subir documento">
          <DocumentUpload target={{ propertyId: id }} defaultCategory="titulo" />
        </Collapsible>
      </Section>

      <Section title="Datos de la propiedad">
        <Collapsible label="Editar propiedad">
          <PropertyForm property={property} />
          <form action={deleteProperty} className="mt-3">
            <input type="hidden" name="id" value={id} />
            <SubmitButton variant="danger" confirm="¿Borrar esta propiedad y todas sus unidades? No se puede deshacer.">
              Borrar propiedad
            </SubmitButton>
          </form>
        </Collapsible>
      </Section>
    </>
  );
}
