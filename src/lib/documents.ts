import { getDb } from "./db";
import { documents } from "./db/schema";

export const CATEGORIES: Record<string, string> = {
  contrato: "Contrato",
  identificacion: "Identificación",
  comprobante: "Comprobante de pago",
  titulo: "Título / escritura",
  factura: "Factura / servicio",
  foto: "Foto",
  otro: "Otro",
};

export type DocTarget = {
  propertyId?: number | null;
  unitId?: number | null;
  tenantId?: number | null;
  leaseId?: number | null;
};

export function parseTarget(input: Record<string, unknown>): DocTarget {
  const n = (v: unknown) => {
    const x = Number(v);
    return Number.isInteger(x) && x > 0 ? x : null;
  };
  return {
    propertyId: n(input.propertyId),
    unitId: n(input.unitId),
    tenantId: n(input.tenantId),
    leaseId: n(input.leaseId),
  };
}

/** Carpeta lógica dentro del almacén según a quién pertenece el documento. */
export function folderFor(t: DocTarget): string {
  if (t.tenantId) return `inquilinos/${t.tenantId}`;
  if (t.leaseId) return `contratos/${t.leaseId}`;
  if (t.propertyId) return `propiedades/${t.propertyId}`;
  if (t.unitId) return `unidades/${t.unitId}`;
  return "general";
}

export async function registerDocument(file: {
  pathname: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
  category: string;
  target: DocTarget;
}) {
  const [row] = await getDb()
    .insert(documents)
    .values({
      ...file.target,
      name: file.name.slice(0, 200),
      category: CATEGORIES[file.category] ? file.category : "otro",
      storagePath: file.pathname,
      mimeType: file.mimeType ?? null,
      size: file.size ?? null,
    })
    .returning();
  return row;
}
