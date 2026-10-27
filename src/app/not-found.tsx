import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-bold">No encontramos esa página</h1>
      <p className="text-muted">Puede que el registro se haya borrado.</p>
      <Link href="/" className="font-semibold text-caribe hover:underline">
        Volver al inicio
      </Link>
    </main>
  );
}
