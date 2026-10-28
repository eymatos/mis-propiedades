export const metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; faltan?: string }>;
}) {
  const { error, faltan } = await searchParams;
  const message =
    error === "clave"
      ? "Contraseña incorrecta."
      : error === "config"
        ? `Falta configurar en Vercel (Settings → Environment Variables): ${faltan?.split(",").join(", ")}. Después haz Redeploy.`
        : null;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <img src="/icon.svg" alt="" className="mb-6 h-14 w-14" />
        <h1 className="text-3xl font-bold tracking-tight">Mis Propiedades</h1>
        <p className="mt-2 text-muted">Cobros, inquilinos y documentos de tus propiedades.</p>
        {message && (
          <p role="alert" className="mt-5 rounded-lg border border-late/30 bg-late-soft px-4 py-3 text-sm text-late">
            {message}
          </p>
        )}
        <form action="/api/auth/login" method="post" className="mt-8 grid gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Contraseña</span>
            <input
              type="password"
              name="password"
              required
              autoFocus
              autoComplete="current-password"
              className="w-full rounded-lg border border-line bg-surface px-3 py-3 focus:border-caribe focus:outline-none"
            />
          </label>
          <button className="w-full rounded-lg bg-caribe px-4 py-3 font-semibold text-white hover:bg-caribe-dark">Entrar</button>
        </form>
      </div>
    </main>
  );
}
