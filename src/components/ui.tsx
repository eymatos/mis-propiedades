import Link from "next/link";
import type { ReactNode } from "react";
import { formatDOP } from "@/lib/money";
import type { Tone } from "@/lib/billing";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-caribe px-4 py-2.5 text-sm font-semibold text-white hover:bg-caribe-dark disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:border-caribe hover:text-caribe disabled:opacity-60",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-late hover:bg-late-soft disabled:opacity-60",
  whatsapp:
    "inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#1f8f4e] px-3 py-2 text-sm font-semibold text-white hover:bg-[#18723e]",
  ghost: "inline-flex items-center gap-1 text-sm font-semibold text-caribe hover:underline",
};

export const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-ink placeholder:text-muted/60 focus:border-caribe focus:outline-none";

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6">
      {back && (
        <Link href={back.href} className="mb-2 inline-block text-sm text-muted hover:text-caribe">
          ‹ {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Section({
  title,
  aside,
  children,
  className,
}: {
  title?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("mb-8", className)}>
      {(title || aside) && (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          {title && <h2 className="text-lg font-bold tracking-tight">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-xl border border-line bg-surface", className)}>{children}</div>;
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Money({ value, className }: { value: number; className?: string }) {
  return <span className={cx("num whitespace-nowrap", className)}>{formatDOP(value)}</span>;
}

const toneStyles: Record<Tone, { bar: string; chip: string }> = {
  paid: { bar: "bg-paid", chip: "bg-paid-soft text-paid" },
  late: { bar: "bg-late", chip: "bg-late-soft text-late" },
  due: { bar: "bg-due", chip: "bg-due-soft text-due" },
  neutral: { bar: "bg-line", chip: "bg-mist text-muted" },
};

export function StatusChip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={cx("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold", toneStyles[tone].chip)}>
      {children}
    </span>
  );
}

/** Fila del libro de cobros: banda de color a la izquierda según el estado. */
export function LedgerRow({
  tone,
  children,
  href,
}: {
  tone: Tone;
  children: ReactNode;
  href?: string;
}) {
  const inner = (
    <>
      <span aria-hidden className={cx("absolute inset-y-0 left-0 w-1.5", toneStyles[tone].bar)} />
      <div className="pl-3">{children}</div>
    </>
  );
  const cls = "ledger-row relative block overflow-hidden border-b border-line px-4 py-3 last:border-b-0";
  return href ? (
    <Link href={href} className={cx(cls, "hover:bg-mist/60")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface/60 px-5 py-8 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <div
      role="status"
      className={cx(
        "mb-5 rounded-lg border px-4 py-3 text-sm",
        error ? "border-late/30 bg-late-soft text-late" : "border-paid/30 bg-paid-soft text-paid",
      )}
    >
      {error ?? ok}
    </div>
  );
}

/** Formulario plegable: el botón muestra el formulario sin salir de la página. */
export function Collapsible({
  label,
  children,
  open,
  variant = "secondary",
}: {
  label: string;
  children: ReactNode;
  open?: boolean;
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <details className="group" open={open}>
      <summary className={cx(btn[variant], "select-none")}>
        <span className="transition-transform group-open:rotate-45" aria-hidden>
          +
        </span>
        {label}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

export function KeyValue({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs text-muted">{k}</dt>
          <dd className="font-medium">{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function WhatsAppLink({ href, label = "WhatsApp" }: { href: string | null; label?: string }) {
  if (!href) return <span className="text-xs text-muted">Sin teléfono</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={btn.whatsapp}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.4-.3Z" />
      </svg>
      {label}
    </a>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return <span className="inline-block rounded-md bg-mist px-2 py-0.5 text-xs font-medium text-muted">{children}</span>;
}
