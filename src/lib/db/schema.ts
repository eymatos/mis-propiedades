import {
  bigint,
  boolean,
  date,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Nota: los montos (numeric) llegan como texto; usar toNumber() de lib/money.

const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("edificio"),
  address: text("address"),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const units = pgTable("units", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull().default("apartamento"),
  suggestedRent: numeric("suggested_rent", { precision: 12, scale: 2 }),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  idNumber: text("id_number"),
  phone: text("phone"),
  email: text("email"),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const leases = pgTable("leases", {
  id: serial("id").primaryKey(),
  unitId: integer("unit_id")
    .notNull()
    .references(() => units.id, { onDelete: "restrict" }),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "restrict" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  monthlyRent: numeric("monthly_rent", { precision: 12, scale: 2 }).notNull(),
  /** Primer mes ("YYYY-MM") desde el que se generan cuotas. */
  billingFrom: text("billing_from"),
  paymentDay: integer("payment_day").notNull().default(1),
  graceDays: integer("grace_days").notNull().default(5),
  deposit: numeric("deposit", { precision: 12, scale: 2 }),
  active: boolean("active").notNull().default(true),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const charges = pgTable(
  "charges",
  {
    id: serial("id").primaryKey(),
    leaseId: integer("lease_id")
      .notNull()
      .references(() => leases.id, { onDelete: "cascade" }),
    /** "YYYY-MM" para cuotas de alquiler; null para cargos extra. */
    period: text("period"),
    concept: text("concept").notNull().default("Alquiler"),
    dueDate: date("due_date").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("charges_lease_period_uq").on(t.leaseId, t.period)],
);

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  chargeId: integer("charge_id")
    .notNull()
    .references(() => charges.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paidAt: date("paid_at").notNull(),
  method: text("method").notNull().default("efectivo"),
  reference: text("reference"),
  receiptNumber: integer("receipt_number"),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").references(() => properties.id, { onDelete: "cascade" }),
  unitId: integer("unit_id").references(() => units.id, { onDelete: "cascade" }),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  leaseId: integer("lease_id").references(() => leases.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull().default("otro"),
  /** Ruta del archivo en Vercel Blob (privado). */
  storagePath: text("storage_path").notNull(),
  mimeType: text("mime_type"),
  size: bigint("size", { mode: "number" }),
  createdAt: createdAt(),
});

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type Property = typeof properties.$inferSelect;
export type Unit = typeof units.$inferSelect;
export type Tenant = typeof tenants.$inferSelect;
export type Lease = typeof leases.$inferSelect;
export type Charge = typeof charges.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
