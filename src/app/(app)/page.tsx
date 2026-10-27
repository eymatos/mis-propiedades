import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { leases, payments, properties, tenants, units } from "@/lib/db/schema";
import { ensureCharges, lateLink, loadCharges, reminderLink, statusText, toneOf } from "@/lib/billing";
import { addDays, addMonths, currentPeriod, diffDays, formatDate, formatDateLong, periodLabel, todayISO } from "@/lib/dates";
import { round2, toNumber } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { driveStatus } from "@/lib/google";
import { btn, EmptyState, LedgerRow, Money, Panel, Section, StatusChip, WhatsAppLink } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const db = getDb();
  const today = todayISO();
  const period = currentPeriod();
  await ensureCharges(today);

  const [all, settings, unitRows, activeLeases, monthPayments, drive, propCount] = await Promise.all([
    loadCharges({}, today),
    getSettings(),
    db.select({ id: units.id }).from(units),
    db
      .select({ lease: leases, tenantName: tenants.fullName, tenantId: tenants.id, unitName: units.name, propertyName: properties.name })
      .from(leases)
      .innerJoin(tenants, eq(leases.tenantId, tenants.id))
      .innerJoin(units, eq(leases.unitId, units.id))
      .innerJoin(properties, eq(units.propertyId, properties.id))
      .where(eq(leases.active, true)),
    db
      .select({ amount: payments.amount })
      .from(payments)
      .where(and(sql`${payments.paidAt} >= ${`${period}-01`}`, sql`${payments.paidAt} < ${`${addMonths(period, 1)}-01`}`)),
    driveStatus(),
    db.select({ n: sql<number>`count(*)::int` }).from(properties),
  ]);

  if (!propCount[0]?.n) return <Onboarding />;

  const reminderDays = Number(settings.reminder_days) || 5;
  const late = all.filter((c) => c.isLate).sort((a, b) => b.daysLate - a.daysLate);
  const upcoming = all.filter((c) => c.status !== "pagado" && !c.isLate && c.daysToDue <= reminderDays && c.daysToDue >= -c.graceDays);
  const thisMonth = all.filter((c) => c.dueDate.startsWith(period));
  const collected = round2(monthPayments.reduce((s, p) => s + toNumber(p.amount), 0));
  const pendingMonth = round2(thisMonth.reduce((s, c) => s + c.balance, 0));
  const lateTotal = round2(late.reduce((s, c) => s + c.balance, 0));
  const occupied = new Set(activeLeases.map((l) => l.lease.unitId)).size;
  const occupancy = unitRows.length ? Math.round((occupied / unitRows.length) * 100) : 0;
  const expiring = activeLeases
    .filter((l) => l.lease.endDate && l.lease.endDate <= addDays(today, 45))
    .sort((a, b) => (a.lease.endDate ?? "").localeCompare(b.lease.endDate ?? ""));

  return (
    <>
      <header className="mb-6">
        <p className="text-sm text-muted">{formatDateLong(today)}</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {late.length
            ? `${late.length} ${late.length === 1 ? "cobro atrasado" : "cobros atrasados"}`
            : "Todo al día"}
        </h1>
      </header>

      {!drive.connected && (
        <div className="mb-6 rounded-lg border border-due/30 bg-due-soft px-4 py-3 text-sm text-due">
          Google Drive no está conectado: los recibos y documentos no se podrán guardar.{" "}
          <form action="/api/auth/logout" method="post" className="inline">
            <button className="font-semibold underline">Vuelve a entrar con Google</button>
          </form>{" "}
          y acepta el permiso de Drive.
        </div>
      )}

      {/* Totales del mes, como la última línea de un libro de cuentas */}
      <Panel className="mb-8 grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="p-4">
          <p className="text-sm text-muted">Cobrado en {periodLabel(period).toLowerCase()}</p>
          <Money value={collected} className="text-2xl font-bold text-paid" />
        </div>
        <div className="p-4">
          <p className="text-sm text-muted">Falta por cobrar este mes</p>
          <Money value={pendingMonth} className="text-2xl font-bold" />
        </div>
        <div className="p-4">
          <p className="text-sm text-muted">Deuda atrasada total</p>
          <Money value={lateTotal} className={`text-2xl font-bold ${lateTotal > 0 ? "text-late" : ""}`} />
        </div>
        <div className="p-4 sm:col-span-3">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted">Ocupación</span>
            <span className="num font-semibold">
              {occupied} de {unitRows.length} unidades · {occupancy}%
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-mist" role="presentation">
            <div className="h-full rounded-full bg-caribe" style={{ width: `${occupancy}%` }} />
          </div>
        </div>
      </Panel>

      <Section
        title="Atrasados"
        aside={late.length > 0 && <Link href="/cobros?estado=atrasado" className={btn.ghost}>Ver todos</Link>}
      >
        {late.length === 0 ? (
          <EmptyState title="Ningún inquilino está atrasado." />
        ) : (
          <Panel className="overflow-hidden">
            {late.slice(0, 12).map((c) => (
              <LedgerRow key={c.id} tone="late">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link href={`/cobros/${c.id}`} className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{c.tenant.fullName}</p>
                    <p className="truncate text-sm text-muted">
                      {c.label} · {c.unit.name}, {c.property.name}
                    </p>
                  </Link>
                  <div className="text-right">
                    <Money value={c.balance} className="text-lg font-bold text-late" />
                    <p className="text-xs font-semibold text-late">{statusText(c)}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <WhatsAppLink href={lateLink(c, settings)} label="Avisar atraso" />
                  <Link href={`/cobros/${c.id}#pago`} className={btn.secondary}>
                    Registrar pago
                  </Link>
                </div>
              </LedgerRow>
            ))}
          </Panel>
        )}
      </Section>

      <Section title={`Próximos cobros (${reminderDays} días)`}>
        {upcoming.length === 0 ? (
          <EmptyState title="No hay cobros por vencer en los próximos días." />
        ) : (
          <Panel className="overflow-hidden">
            {upcoming.map((c) => (
              <LedgerRow key={c.id} tone={toneOf(c)}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link href={`/cobros/${c.id}`} className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{c.tenant.fullName}</p>
                    <p className="truncate text-sm text-muted">
                      {c.label} · {c.unit.name}, {c.property.name}
                    </p>
                  </Link>
                  <div className="text-right">
                    <Money value={c.balance} className="text-lg font-bold" />
                    <p className="text-xs text-muted">{formatDate(c.dueDate)}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusChip tone={toneOf(c)}>{statusText(c)}</StatusChip>
                  <WhatsAppLink href={reminderLink(c, settings)} label="Recordar pago" />
                  <Link href={`/cobros/${c.id}#pago`} className={btn.secondary}>
                    Registrar pago
                  </Link>
                </div>
              </LedgerRow>
            ))}
          </Panel>
        )}
      </Section>

      {expiring.length > 0 && (
        <Section title="Contratos por vencer">
          <Panel className="divide-y divide-line">
            {expiring.map((l) => {
              const days = diffDays(l.lease.endDate!, today);
              return (
                <Link key={l.lease.id} href={`/contratos/${l.lease.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-mist/60">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{l.tenantName}</p>
                    <p className="truncate text-sm text-muted">
                      {l.unitName}, {l.propertyName}
                    </p>
                  </div>
                  <StatusChip tone={days < 0 ? "late" : "due"}>
                    {days < 0 ? `Venció hace ${-days} días` : days === 0 ? "Vence hoy" : `Vence en ${days} días`}
                  </StatusChip>
                </Link>
              );
            })}
          </Panel>
        </Section>
      )}
    </>
  );
}

function Onboarding() {
  const steps: [string, string, string][] = [
    ["Registra una propiedad", "Un edificio, plaza, casa o local, con sus apartamentos o locales.", "/propiedades"],
    ["Registra a tus inquilinos", "Nombre, cédula y teléfono de WhatsApp.", "/inquilinos"],
    ["Crea los contratos", "Monto, día de pago y días de gracia. Las cuotas se generan solas cada mes.", "/contratos/nuevo"],
  ];
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Empecemos</h1>
      <p className="mt-1 text-muted">Tres pasos para tener tus cobros bajo control.</p>
      <ol className="mt-6 grid gap-3">
        {steps.map(([title, text, href], i) => (
          <li key={href}>
            <Link href={href} className="flex gap-4 rounded-xl border border-line bg-surface p-4 hover:border-caribe">
              <span className="num flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-caribe-soft font-bold text-caribe-dark">
                {i + 1}
              </span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="block text-sm text-muted">{text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}
