"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const CATEGORIES: [string, string][] = [
  ["contrato", "Contrato"],
  ["identificacion", "Identificación"],
  ["comprobante", "Comprobante de pago"],
  ["titulo", "Título / escritura"],
  ["factura", "Factura / servicio"],
  ["foto", "Foto"],
  ["otro", "Otro"],
];

const SERVER_LIMIT = 4 * 1024 * 1024;

type Target = { propertyId?: number; unitId?: number; tenantId?: number; leaseId?: number };

async function uploadDirect(file: File, name: string, category: string, target: Target) {
  const s = await fetch("/api/documentos/sesion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: file.type || "application/octet-stream", size: file.size, category, ...target }),
  });
  const sj = (await s.json()) as { uploadUrl?: string; error?: string };
  if (!s.ok || !sj.uploadUrl) throw new Error(sj.error ?? "No se pudo iniciar la subida.");

  const put = await fetch(sj.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!put.ok) throw new Error(`Drive respondió ${put.status}`);
  const meta = (await put.json()) as { id: string };

  const r = await fetch("/api/documentos/registrar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileId: meta.id, category, ...target }),
  });
  if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? "No se pudo registrar.");
}

async function uploadViaServer(file: File, name: string, category: string, target: Target) {
  const fd = new FormData();
  fd.set("file", file);
  fd.set("name", name);
  fd.set("category", category);
  for (const [k, v] of Object.entries(target)) if (v) fd.set(k, String(v));
  const r = await fetch("/api/documentos/subir", { method: "POST", body: fd });
  if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? "No se pudo subir.");
}

export function DocumentUpload({ target, defaultCategory = "otro" }: { target: Target; defaultCategory?: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const files = Array.from(fileRef.current?.files ?? []);
    if (!files.length) {
      setMsg({ ok: false, text: "Elige al menos un archivo." });
      return;
    }
    const category = (form.elements.namedItem("category") as HTMLSelectElement).value;
    const customName = (form.elements.namedItem("docname") as HTMLInputElement).value.trim();
    setBusy(true);
    setMsg(null);
    try {
      for (const [i, file] of files.entries()) {
        const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
        const name = customName ? `${customName}${files.length > 1 ? ` (${i + 1})` : ""}${ext}` : file.name;
        try {
          await uploadDirect(file, name, category, target);
        } catch (err) {
          if (file.size > SERVER_LIMIT) throw err;
          await uploadViaServer(file, name, category, target);
        }
      }
      form.reset();
      setMsg({ ok: true, text: files.length > 1 ? `${files.length} archivos guardados en Drive.` : "Archivo guardado en Drive." });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: `No se pudo subir: ${(err as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className="block sm:col-span-3">
        <span className="mb-1 block text-sm font-medium">Archivos</span>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-caribe-soft file:px-3 file:py-2 file:font-semibold file:text-caribe-dark"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Tipo</span>
        <select name="category" defaultValue={defaultCategory} className="w-full rounded-lg border border-line bg-surface px-3 py-2.5">
          {CATEGORIES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Nombre (opcional)</span>
        <input name="docname" placeholder="Ej. Contrato 2026" className="w-full rounded-lg border border-line bg-surface px-3 py-2.5" />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center justify-center rounded-lg bg-caribe px-4 py-2.5 text-sm font-semibold text-white hover:bg-caribe-dark disabled:opacity-60"
      >
        {busy ? "Subiendo…" : "Subir a Drive"}
      </button>
      {msg && (
        <p role="status" className={`text-sm sm:col-span-3 ${msg.ok ? "text-paid" : "text-late"}`}>
          {msg.text}
        </p>
      )}
    </form>
  );
}
