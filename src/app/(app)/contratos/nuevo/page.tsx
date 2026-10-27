import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { leases, properties, tenants, units } from "@/lib/db/schema";
import { todayISO } from "@/lib/dates";
import { LeaseForm, TenantForm } from "@/components/forms";
import { btn, Collapsible, EmptyState, Flash, PageHeader, Section } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nuevo contrato" };

export default async function NewLeasePage({
  searchParams,
}: {
  searchParams: Promise<{ unidad?: string; inquilino?: string; error?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const db = getDb();
  const [unitRows, tenantRows, active] = await Promise.all([
    db
      .select({ id: units.id, name: units.name, suggestedRent: units.suggestedRent, propertyName: properties.name })
      .from(units)
      .innerJoin(properties, eq(units.propertyId, properties.id))
      .orderBy(properties.name, units.name),
    db.select({ id: tenants.id, fullName: tenants.fullName }).from(tenants).orderBy(tenants.fullName),
    db.select({ unitId: leases.unitId }).from(leases).where(eq(leases.active, true)),
  ]);
  const busy = new Set(active.map((a) => a.unitId));
  const unitOptions = unitRows.map((u) => ({ ...u, occupied: busy.has(u.id) }));
  const defaultUnit = Number(sp.unidad) || undefined;
  const defaultTenant = Number(sp.inquilino) || undefined;

  if (!unitRows.length) {
    return (
      <>
        <PageHeader title="Nuevo contrato" back={{ href: "/", label: "Inicio" }} />
        <EmptyState title="Primero registra una propiedad con sus unidades.">
          <Link href="/propiedades" className={btn.ghost}>
            Ir a propiedades
          </Link>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Nuevo contrato"
        subtitle="Al guardarlo se crean solas las cuotas de cada mes."
        back={{ href: defaultTenant ? `/inquilinos/${defaultTenant}` : "/inquilinos", label: "Volver" }}
      />
      <Flash ok={sp.ok} error={sp.error} />
      {tenantRows.length === 0 ? (
        <Section title="Primero, el inquilino">
          <TenantForm next="contrato" unitId={defaultUnit} />
        </Section>
      ) : (
        <>
          <div className="mb-4">
            <Collapsible label="El inquilino no está registrado" variant="ghost">
              <TenantForm next="contrato" unitId={defaultUnit} />
            </Collapsible>
          </div>
          <LeaseForm
            unitOptions={unitOptions}
            tenantOptions={tenantRows}
            defaultUnit={defaultUnit}
            defaultTenant={defaultTenant}
            today={todayISO()}
          />
        </>
      )}
    </>
  );
}
