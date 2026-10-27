import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { leases, properties, units } from "@/lib/db/schema";
import { PROPERTY_TYPES, PropertyForm, label } from "@/components/forms";
import { Collapsible, EmptyState, Flash, PageHeader, Panel, Pill } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Propiedades" };

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const db = getDb();
  const [props, unitRows, active] = await Promise.all([
    db.select().from(properties).orderBy(properties.name),
    db.select({ id: units.id, propertyId: units.propertyId }).from(units),
    db.select({ unitId: leases.unitId }).from(leases).where(eq(leases.active, true)),
  ]);
  const occupied = new Set(active.map((a) => a.unitId));

  return (
    <>
      <PageHeader title="Propiedades" subtitle="Edificios, plazas, casas y locales con sus unidades." />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="mb-6">
        <Collapsible label="Nueva propiedad" variant="primary" open={props.length === 0}>
          <PropertyForm />
        </Collapsible>
      </div>
      {props.length === 0 ? (
        <EmptyState title="Aún no tienes propiedades registradas." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {props.map((p) => {
            const us = unitRows.filter((u) => u.propertyId === p.id);
            const occ = us.filter((u) => occupied.has(u.id)).length;
            return (
              <Link key={p.id} href={`/propiedades/${p.id}`} className="block">
                <Panel className="h-full p-4 hover:border-caribe">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold">{p.name}</p>
                    <Pill>{label(PROPERTY_TYPES, p.type)}</Pill>
                  </div>
                  {p.address && <p className="mt-0.5 truncate text-sm text-muted">{p.address}</p>}
                  <p className="num mt-3 text-sm">
                    {us.length === 0 ? (
                      <span className="text-due">Sin unidades: agrega apartamentos o locales</span>
                    ) : (
                      <>
                        <span className="font-semibold">{occ}</span> ocupadas · <span className="font-semibold">{us.length - occ}</span>{" "}
                        disponibles
                      </>
                    )}
                  </p>
                </Panel>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
