import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { documents, leases, units } from "./db/schema";
import { getEntityFolder, getFolderPath, getSubfolder, type DriveFile } from "./google";

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

/** Decide en qué carpeta de Drive va el documento. */
export async function folderForTarget(t: DocTarget): Promise<string> {
  const db = getDb();
  let tenantId = t.tenantId ?? null;
  let propertyId = t.propertyId ?? null;
  if (!tenantId && t.leaseId) {
    const [l] = await db.select({ tenantId: leases.tenantId }).from(leases).where(eq(leases.id, t.leaseId));
    tenantId = l?.tenantId ?? null;
  }
  if (!tenantId && !propertyId && t.unitId) {
    const [u] = await db.select({ propertyId: units.propertyId }).from(units).where(eq(units.id, t.unitId));
    propertyId = u?.propertyId ?? null;
  }
  if (tenantId) return getSubfolder(await getEntityFolder("tenant", tenantId), "Documentos");
  if (propertyId) return getSubfolder(await getEntityFolder("property", propertyId), "Documentos");
  return getFolderPath("General");
}

export async function registerDocument(file: DriveFile, category: string, t: DocTarget) {
  const [row] = await getDb()
    .insert(documents)
    .values({
      ...t,
      name: file.name,
      category: CATEGORIES[category] ? category : "otro",
      driveFileId: file.id,
      webViewLink: file.webViewLink ?? null,
      mimeType: file.mimeType ?? null,
      size: file.size ? Number(file.size) : null,
    })
    .returning();
  return row;
}
