import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

function createDb(url: string) {
  return drizzle({ client: neon(url), schema });
}

type DB = ReturnType<typeof createDb>;
let _db: DB | undefined;

/** URL de Neon, aunque la integración se haya conectado con otro prefijo. */
export function databaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;
  for (const [key, value] of Object.entries(process.env)) {
    if (value && (key.endsWith("_DATABASE_URL") || key.endsWith("_POSTGRES_URL")) && value.startsWith("postgres")) return value;
  }
  return undefined;
}

/** Conexión perezosa: no falla durante el build si aún no hay DATABASE_URL. */
export function getDb(): DB {
  if (!_db) {
    const url = databaseUrl();
    if (!url) throw new Error("Falta la variable DATABASE_URL (conexión a Neon).");
    _db = createDb(url);
  }
  return _db;
}

export { schema };

// --- Creación automática de tablas -----------------------------------------
// La app crea sus tablas la primera vez que arranca: no hace falta correr
// migraciones a mano. Si en el futuro cambia el esquema, se sube SCHEMA_VERSION
// y se agregan sentencias idempotentes (ADD COLUMN IF NOT EXISTS, etc.).

const SCHEMA_VERSION = "2";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS properties (
    id serial PRIMARY KEY,
    name text NOT NULL,
    type text NOT NULL DEFAULT 'edificio',
    address text,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS units (
    id serial PRIMARY KEY,
    property_id integer NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name text NOT NULL,
    type text NOT NULL DEFAULT 'apartamento',
    suggested_rent numeric(12,2),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS tenants (
    id serial PRIMARY KEY,
    full_name text NOT NULL,
    id_number text,
    phone text,
    email text,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS leases (
    id serial PRIMARY KEY,
    unit_id integer NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    start_date date NOT NULL,
    end_date date,
    monthly_rent numeric(12,2) NOT NULL,
    billing_from text,
    payment_day integer NOT NULL DEFAULT 1,
    grace_days integer NOT NULL DEFAULT 5,
    deposit numeric(12,2),
    active boolean NOT NULL DEFAULT true,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS charges (
    id serial PRIMARY KEY,
    lease_id integer NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
    period text,
    concept text NOT NULL DEFAULT 'Alquiler',
    due_date date NOT NULL,
    amount numeric(12,2) NOT NULL,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS charges_lease_period_uq ON charges (lease_id, period)`,
  `CREATE INDEX IF NOT EXISTS charges_due_date_idx ON charges (due_date)`,
  `CREATE TABLE IF NOT EXISTS payments (
    id serial PRIMARY KEY,
    charge_id integer NOT NULL REFERENCES charges(id) ON DELETE CASCADE,
    amount numeric(12,2) NOT NULL,
    paid_at date NOT NULL,
    method text NOT NULL DEFAULT 'efectivo',
    reference text,
    receipt_number integer,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS payments_charge_idx ON payments (charge_id)`,
  `CREATE TABLE IF NOT EXISTS documents (
    id serial PRIMARY KEY,
    property_id integer REFERENCES properties(id) ON DELETE CASCADE,
    unit_id integer REFERENCES units(id) ON DELETE CASCADE,
    tenant_id integer REFERENCES tenants(id) ON DELETE CASCADE,
    lease_id integer REFERENCES leases(id) ON DELETE CASCADE,
    name text NOT NULL,
    category text NOT NULL DEFAULT 'otro',
    storage_path text NOT NULL,
    mime_type text,
    size bigint,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    key text PRIMARY KEY,
    value text NOT NULL
  )`,
  // Versión 2: los archivos pasan de Google Drive a Vercel Blob.
  `ALTER TABLE leases ADD COLUMN IF NOT EXISTS billing_from text`,
  `ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_path text`,
  `ALTER TABLE documents DROP COLUMN IF EXISTS drive_file_id`,
  `ALTER TABLE documents DROP COLUMN IF EXISTS web_view_link`,
  `ALTER TABLE properties DROP COLUMN IF EXISTS drive_folder_id`,
  `ALTER TABLE tenants DROP COLUMN IF EXISTS drive_folder_id`,
  `ALTER TABLE payments DROP COLUMN IF EXISTS receipt_drive_id`,
  `ALTER TABLE payments DROP COLUMN IF EXISTS receipt_url`,
  `DROP TABLE IF EXISTS google_auth`,
];

let ready: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!ready) {
    ready = migrate().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

function rowsOf(result: unknown): Record<string, unknown>[] {
  const r = result as { rows?: Record<string, unknown>[] };
  return Array.isArray(r?.rows) ? r.rows : Array.isArray(result) ? (result as Record<string, unknown>[]) : [];
}

async function migrate() {
  const db = getDb();
  const exists = rowsOf(await db.execute(sql`select to_regclass('public.app_settings') as t`));
  if (exists[0]?.t) {
    const v = rowsOf(await db.execute(sql`select value from app_settings where key = 'schema_version'`));
    if (v[0]?.value === SCHEMA_VERSION) return;
  }
  for (const stmt of STATEMENTS) {
    await db.execute(sql.raw(stmt));
  }
  await db.execute(
    sql`insert into app_settings (key, value) values ('schema_version', ${SCHEMA_VERSION})
        on conflict (key) do update set value = excluded.value`,
  );
}
