import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { documents, properties, tenants } from "@/lib/db/schema";
import { CATEGORIES } from "@/lib/documents";
import { DocumentUpload } from "@/components/document-upload";
import { DocumentList } from "@/components/lists";
import { Collapsible, cx, Flash, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documentos" };

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const tipo = sp.tipo && CATEGORIES[sp.tipo] ? sp.tipo : null;
  const db = getDb();
  const [rows] = await Promise.all([
    db
      .select({ doc: documents, tenantName: tenants.fullName, propertyName: properties.name })
      .from(documents)
      .leftJoin(tenants, eq(documents.tenantId, tenants.id))
      .leftJoin(properties, eq(documents.propertyId, properties.id))
      .where(tipo ? eq(documents.category, tipo) : undefined)
      .orderBy(desc(documents.createdAt))
      .limit(300),
  ]);
  const context = new Map<number, string>(rows.map((r) => [r.doc.id, r.tenantName ?? r.propertyName ?? "General"] as [number, string]));

  return (
    <>
      <PageHeader
        title="Documentos"
        subtitle="Contratos, cédulas, títulos, comprobantes y fotos, guardados de forma privada."
      />
      <Flash ok={sp.ok} error={sp.error} />

      <div className="mb-5">
        <Collapsible label="Subir documento general" variant="primary">
          <p className="mb-2 text-sm text-muted">
            Para documentos de un inquilino o una propiedad, súbelos desde su página para que queden en su carpeta.
          </p>
          <DocumentUpload target={{}} />
        </Collapsible>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/documentos"
          className={cx("rounded-full border px-3 py-1 text-sm font-semibold", !tipo ? "border-caribe bg-caribe text-white" : "border-line bg-surface")}
        >
          Todos
        </Link>
        {Object.entries(CATEGORIES).map(([k, l]) => (
          <Link
            key={k}
            href={`/documentos?tipo=${k}`}
            className={cx("rounded-full border px-3 py-1 text-sm font-semibold", tipo === k ? "border-caribe bg-caribe text-white" : "border-line bg-surface")}
          >
            {l}
          </Link>
        ))}
      </div>

      <DocumentList docs={rows.map((r) => r.doc)} back={tipo ? `/documentos?tipo=${tipo}` : "/documentos"} context={context} />
    </>
  );
}
