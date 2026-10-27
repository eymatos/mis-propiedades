import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { leases, properties, tenants, units } from "@/lib/db/schema";
import { loadCharges } from "@/lib/billing";
import { round2 } from "@/lib/money";
import { TenantForm } from "@/components/forms";
import { Collapsible, EmptyState, Flash, inputCls, Money, PageHeader, Panel, Pill } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inquilinos" };

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const db = getDb();
  const [list, active, charges] = await Promise.all([
    db.select().from(tenants).orderBy(tenants.fullName),
    db
      .select({ tenantId: leases.tenantId, unitName: units.name, propertyName: properties.name })
      .from(leases)
      .innerJoin(units, eq(leases.unitId, units.id))
      .innerJoin(properties, eq(units.propertyId, properties.id))
      .where(eq(leases.active, true)),
    loadCharges(),
  ]);

  const filtered = q
    ? list.filter((t) => [t.fullName, t.idNumber, t.phone, t.email].some((v) => v?.toLowerCase().includes(q)))
    : list;
  const debtOf = (id: number) =>
    round2(charges.filter((c) => c.tenant.id === id && c.isLate).reduce((s, c) => s + c.balance, 0));

  return (
    <>
      <PageHeader title="Inquilinos" />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="mb-4">
        <Collapsible label="Nuevo inquilino" variant="primary" open={list.length === 0}>
          <TenantForm />
        </Collapsible>
      </div>
      {list.length > 5 && (
        <form className="mb-4">
          <input name="q" defaultValue={sp.q} placeholder="Buscar por nombre, cédula o teléfono" className={inputCls} />
        </form>
      )}
      {filtered.length === 0 ? (
        <EmptyState title={q ? "Ningún inquilino coincide con la búsqueda." : "Aún no tienes inquilinos registrados."} />
      ) : (
        <Panel className="divide-y divide-line">
          {filtered.map((t) => {
            const where = active.filter((a) => a.tenantId === t.id);
            const debt = debtOf(t.id);
            return (
              <Link key={t.id} href={`/inquilinos/${t.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-mist/60">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{t.fullName}</p>
                  <p className="truncate text-sm text-muted">
                    {where.length ? where.map((w) => `${w.unitName}, ${w.propertyName}`).join(" · ") : "Sin contrato activo"}
                  </p>
                </div>
                {debt > 0 ? (
                  <span className="text-right">
                    <Money value={debt} className="font-bold text-late" />
                    <span className="block text-xs text-late">atrasado</span>
                  </span>
                ) : where.length ? (
                  <Pill>Al día</Pill>
                ) : null}
              </Link>
            );
          })}
        </Panel>
      )}
    </>
  );
}
