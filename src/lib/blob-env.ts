// Encuentra las credenciales de Vercel Blob aunque el almacén se haya conectado
// con un prefijo distinto al de por defecto (BLOB_...).

function findEnv(exact: string, suffix: string, test?: (v: string) => boolean): string | undefined {
  const direct = process.env[exact];
  if (direct && (!test || test(direct))) return direct;
  for (const [key, value] of Object.entries(process.env)) {
    if (value && key.endsWith(suffix) && (!test || test(value))) return value;
  }
  return undefined;
}

/** Token de lectura y escritura (empieza con "vercel_blob_rw_"). */
export function blobToken(): string | undefined {
  return findEnv("BLOB_READ_WRITE_TOKEN", "READ_WRITE_TOKEN", (v) => v.startsWith("vercel_blob_rw_"));
}

/** ID del almacén (se usa cuando Vercel conecta el almacén sin token). */
export function blobStoreId(): string | undefined {
  return findEnv("BLOB_STORE_ID", "_STORE_ID");
}

/** Opciones comunes para todas las llamadas a Vercel Blob. */
export function blobAuth(): { token?: string; storeId?: string } {
  const token = blobToken();
  const storeId = blobStoreId();
  return { ...(token ? { token } : {}), ...(storeId ? { storeId } : {}) };
}

export function blobConfigured(): boolean {
  return Boolean(blobToken() || blobStoreId());
}
