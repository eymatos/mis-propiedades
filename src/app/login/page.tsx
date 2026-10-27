const ERRORS: Record<string, string> = {
  no_autorizado: "Esa cuenta de Google no tiene permiso para entrar. Usa el correo configurado en ALLOWED_EMAILS.",
  cancelado: "Cancelaste el inicio de sesión con Google.",
  estado: "La sesión de inicio expiró. Vuelve a intentarlo.",
  google: "Google no pudo completar el inicio de sesión. Revisa la configuración de las credenciales.",
};

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <img src="/icon.svg" alt="" className="mb-6 h-14 w-14" />
        <h1 className="text-3xl font-bold tracking-tight">Mis Propiedades</h1>
        <p className="mt-2 text-muted">
          Cobros, inquilinos y documentos de tus propiedades. Entra con tu cuenta de Google; tus archivos se guardan
          en tu propio Google Drive.
        </p>
        {error && (
          <p role="alert" className="mt-5 rounded-lg border border-late/30 bg-late-soft px-4 py-3 text-sm text-late">
            {ERRORS[error] ?? "No se pudo iniciar sesión."}
          </p>
        )}
        <a
          href="/api/auth/login"
          className="mt-8 flex w-full items-center justify-center gap-3 rounded-lg bg-caribe px-4 py-3 font-semibold text-white hover:bg-caribe-dark"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
            <path fill="#fff" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z" />
            <path fill="#fff" opacity=".85" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" />
            <path fill="#fff" opacity=".7" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14Z" />
            <path fill="#fff" opacity=".55" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 5.9 12 5.9Z" />
          </svg>
          Entrar con Google
        </a>
      </div>
    </main>
  );
}
