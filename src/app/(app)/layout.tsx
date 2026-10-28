import Link from "next/link";
import { ensureSchema } from "@/lib/db";
import { BottomNav, SettingsLink, SideNav } from "@/components/client";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await ensureSchema();

  return (
    <div className="md:grid md:min-h-dvh md:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface p-4 md:flex">
        <Link href="/" className="mb-6 flex items-center gap-2 px-2">
          <img src="/icon.svg" alt="" className="h-8 w-8" />
          <span className="text-lg font-bold tracking-tight">Mis Propiedades</span>
        </Link>
        <SideNav />
        <div className="mt-auto border-t border-line pt-4 text-xs text-muted">
          <form action="/api/auth/logout" method="post">
            <button className="mt-2 px-2 font-semibold text-caribe hover:underline">Cerrar sesión</button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-2 backdrop-blur md:hidden">
          <Link href="/" className="flex items-center gap-2">
            <img src="/icon.svg" alt="" className="h-7 w-7" />
            <span className="font-bold tracking-tight">Mis Propiedades</span>
          </Link>
          <SettingsLink />
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-10">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
