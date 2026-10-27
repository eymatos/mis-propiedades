import Link from "next/link";
import { deleteDocument } from "@/app/actions";
import { statusText, toneOf, type ChargeView } from "@/lib/billing";
import { formatDate } from "@/lib/dates";
import { CATEGORIES } from "@/lib/documents";
import type { DocumentRow } from "@/lib/db/schema";
import { SubmitButton } from "./client";
import { EmptyState, LedgerRow, Money, Panel, Pill, StatusChip } from "./ui";

export function ChargeList({
  items,
  showTenant = true,
  empty = "No hay cuotas para mostrar.",
}: {
  items: ChargeView[];
  showTenant?: boolean;
  empty?: string;
}) {
  if (!items.length) return <EmptyState title={empty} />;
  return (
    <Panel className="overflow-hidden">
      {items.map((c) => (
        <LedgerRow key={c.id} tone={toneOf(c)} href={`/cobros/${c.id}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">{showTenant ? c.tenant.fullName : c.label}</p>
              <p className="truncate text-sm text-muted">
                {showTenant ? `${c.label} · ` : ""}
                {c.unit.name}, {c.property.name}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <Money value={c.status === "pagado" ? c.amount : c.balance} className="text-lg font-bold" />
              <p className="text-xs text-muted">Vence {formatDate(c.dueDate)}</p>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusChip tone={toneOf(c)}>{statusText(c)}</StatusChip>
            {c.status === "parcial" && (
              <span className="text-xs text-muted">
                Abonado <Money value={c.paid} /> de <Money value={c.amount} />
              </span>
            )}
            {!c.leaseActive && <Pill>Contrato finalizado</Pill>}
          </div>
        </LedgerRow>
      ))}
    </Panel>
  );
}

function sizeLabel(n: number | null) {
  if (!n) return "";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentList({
  docs,
  back,
  context,
}: {
  docs: DocumentRow[];
  back: string;
  context?: Map<number, string>;
}) {
  if (!docs.length) return <EmptyState title="Sin documentos todavía.">Sube contratos, cédulas, comprobantes o fotos.</EmptyState>;
  return (
    <Panel className="divide-y divide-line">
      {docs.map((d) => (
        <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <a
              href={d.webViewLink ?? `https://drive.google.com/file/d/${d.driveFileId}/view`}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate font-semibold hover:text-caribe hover:underline"
            >
              {d.name}
            </a>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
              <Pill>{CATEGORIES[d.category] ?? d.category}</Pill>
              {context?.get(d.id) && <span>{context.get(d.id)}</span>}
              <span>{formatDate(d.createdAt.toISOString().slice(0, 10))}</span>
              {d.size ? <span>{sizeLabel(d.size)}</span> : null}
            </p>
          </div>
          <form action={deleteDocument}>
            <input type="hidden" name="id" value={d.id} />
            <input type="hidden" name="back" value={back} />
            <SubmitButton variant="danger" pending="…" confirm="¿Quitar este documento de la lista? El archivo se queda en tu Drive.">
              Quitar
            </SubmitButton>
          </form>
        </div>
      ))}
    </Panel>
  );
}

export function TenantLink({ id, name }: { id: number; name: string }) {
  return (
    <Link href={`/inquilinos/${id}`} className="font-semibold hover:text-caribe hover:underline">
      {name}
    </Link>
  );
}
