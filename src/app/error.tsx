"use client";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const missingDb = error.message?.includes("DATABASE_URL");
  return (
    <div className="rounded-xl border border-late/30 bg-late-soft p-5 text-late">
      <h1 className="text-lg font-bold">No se pudo cargar esta página</h1>
      <p className="mt-1 text-sm">
        {missingDb
          ? "Falta configurar la base de datos (variable DATABASE_URL en Vercel)."
          : "Revisa tu conexión e inténtalo de nuevo. Si el problema sigue, revisa los registros (Logs) del proyecto en Vercel."}
      </p>
      <button onClick={reset} className="mt-4 rounded-lg bg-late px-4 py-2 text-sm font-semibold text-white">
        Reintentar
      </button>
    </div>
  );
}
