"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

const SUBMIT_CLS = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-caribe px-4 py-2.5 text-sm font-semibold text-white hover:bg-caribe-dark disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:border-caribe hover:text-caribe disabled:opacity-60",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-late hover:bg-late-soft disabled:opacity-60",
};

export function SubmitButton({
  children,
  pending,
  variant = "primary",
  confirm,
  className,
}: {
  children: ReactNode;
  pending?: string;
  variant?: keyof typeof SUBMIT_CLS;
  confirm?: string;
  className?: string;
}) {
  const status = useFormStatus();
  return (
    <button
      type="submit"
      disabled={status.pending}
      className={`${SUBMIT_CLS[variant]} ${className ?? ""}`}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {status.pending ? pending ?? "Guardando…" : children}
    </button>
  );
}

type NavItem = { href: string; label: string; icon: ReactNode };

const ic = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

export const NAV: NavItem[] = [
  { href: "/", label: "Inicio", icon: ic("M3 11 12 4l9 7M5 10v10h14V10") },
  { href: "/cobros", label: "Cobros", icon: ic("M4 6h16v12H4zM4 10h16M8 15h3") },
  { href: "/propiedades", label: "Propiedades", icon: ic("M4 20V8l6-4 6 4v12M16 12h4v8M8 10h4M8 14h4M8 18h4") },
  { href: "/inquilinos", label: "Inquilinos", icon: ic("M16 19a4 4 0 0 0-8 0M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6M20 19a3 3 0 0 0-3-3M17 9a2 2 0 1 1 0 4") },
  { href: "/documentos", label: "Documentos", icon: ic("M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6") },
];

export const SETTINGS_ITEM: NavItem = {
  href: "/ajustes",
  label: "Ajustes",
  icon: ic("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 15H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.7 4.4V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.3Z"),
};

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {[...NAV, SETTINGS_ITEM].map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(pathname, item.href) ? "page" : undefined}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold ${
            isActive(pathname, item.href) ? "bg-caribe text-white" : "text-ink hover:bg-mist"
          }`}
        >
          {item.icon}
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 pt-2 text-[11px] font-semibold ${
                  active ? "text-caribe" : "text-muted"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SettingsLink() {
  return (
    <Link href="/ajustes" aria-label="Ajustes" className="rounded-lg p-2 text-muted hover:bg-mist hover:text-caribe">
      {SETTINGS_ITEM.icon}
    </Link>
  );
}
