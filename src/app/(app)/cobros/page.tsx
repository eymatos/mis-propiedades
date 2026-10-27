import Link from "next/link";
import { ensureCharges, loadCharges } from "@/lib/billing";
import { addMonths, currentPeriod, periodLabel, todayISO } from "@/lib/dates";
import { round2 } from "@/lib/money";
import { ChargeList } from "@/components/lists";
import { btn, cx, Money, PageHeader, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cobros" };

const FILTERS: [string, string][] = [
  ["todos", "Todos"],
  ["pendiente", "Por cobrar"],
  ["atrasado", "Atrasados"],
  ["pagado", "Pagados"],
];

export default async function CobrosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; estado?: string }>;
}) {
  const sp = await searchParams;
  const today = todayISO();
  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : currentPeriod();
  const estado = FILTERS.some(([k]) => k === sp.estado) ? sp.estado! : "todos";
  await ensureCharges(today);

  // "Atrasados" muestra todas las deudas vencidas, de cualquier mes.
  const items =
    estado === "atrasado"
      ? (await loadCharges({}, today)).filter((c) => c.isLate).sort((a, b) => b.daysLate - a.daysLate)
      : (await loadCharges({ dueFrom: `${mes}-01`, dueTo: `${addMonths(mes, 1)}-01` }, today))
          .filter((c) => c.dueDate < `${addMonths(mes, 1)}-01`)
          .filter((c) =>
            estado === "pendiente" ? c.status !== "pagado" : estado === "pagado" ? c.status === "pagado" : true,
          );

  const total = round2(items.reduce((s, c) => s + c.amount, 0));
  const paid = round2(items.reduce((s, c) => s + c.paid, 0));
  const balance = round2(items.reduce((s, c) => s + c.balance, 0));
  const link = (m: string, e: string) => `/cobros?mes=${m}&estado=${e}`;

  return (
    <>
      <PageHeader title="Cobros" subtitle="Cuotas de alquiler y cargos extra. Toca una para registrar el pago." />

      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {FILTERS.map(([k, label]) => (
          <Link
            key={k}
            href={link(mes, k)}
            role="tab"
            aria-selected={estado === k}
            className={cx(
              "rounded-full border px-3.5 py-1.5 text-sm font-semibold",
              estado === k ? "border-caribe bg-caribe text-white" : "border-line bg-surface text-ink hover:border-caribe",
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      {estado !== "atrasado" && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link href={link(addMonths(mes, -1), estado)} className={btn.secondary} aria-label="Mes anterior">
            ‹
          </Link>
          <p className="text-lg font-bold">{periodLabel(mes)}</p>
          <Link href={link(addMonths(mes, 1), estado)} className={btn.secondary} aria-label="Mes siguiente">
            ›
          </Link>
        </div>
      )}

      {items.length > 0 && (
        <Panel className="mb-4 grid grid-cols-3 divide-x divide-line text-center">
          <div className="p-3">
            <p className="text-xs text-muted">Total</p>
            <Money value={total} className="font-bold" />
          </div>
          <div className="p-3">
            <p className="text-xs text-muted">Cobrado</p>
            <Money value={paid} className="font-bold text-paid" />
          </div>
          <div className="p-3">
            <p className="text-xs text-muted">Pendiente</p>
            <Money value={balance} className={cx("font-bold", balance > 0 && "text-late")} />
          </div>
        </Panel>
      )}

      <ChargeList
        items={items}
        empty={estado === "atrasado" ? "No hay cobros atrasados." : `No hay cuotas en ${periodLabel(mes).toLowerCase()}.`}
      />
    </>
  );
}
