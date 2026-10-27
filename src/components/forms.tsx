import type { Lease, Property, Tenant, Unit } from "@/lib/db/schema";
import { saveLease, saveProperty, saveTenant, saveUnit } from "@/app/actions";
import { SubmitButton } from "./client";
import { Field, inputCls } from "./ui";

export const PROPERTY_TYPES: [string, string][] = [
  ["edificio", "Edificio / torre"],
  ["plaza", "Plaza comercial"],
  ["casa", "Casa"],
  ["local", "Local"],
  ["solar", "Solar / terreno"],
  ["otro", "Otro"],
];

export const UNIT_TYPES: [string, string][] = [
  ["apartamento", "Apartamento"],
  ["local", "Local comercial"],
  ["oficina", "Oficina"],
  ["casa", "Casa"],
  ["habitacion", "Habitación"],
  ["parqueo", "Parqueo"],
  ["otro", "Otro"],
];

export function label(list: [string, string][], v: string) {
  return list.find(([k]) => k === v)?.[1] ?? v;
}

export function PropertyForm({ property }: { property?: Property }) {
  return (
    <form action={saveProperty} className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2">
      {property && <input type="hidden" name="id" value={property.id} />}
      <Field label="Nombre">
        <input name="name" required defaultValue={property?.name} placeholder="Ej. Torre Los Prados" className={inputCls} />
      </Field>
      <Field label="Tipo">
        <select name="type" defaultValue={property?.type ?? "edificio"} className={inputCls}>
          {PROPERTY_TYPES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Dirección" className="sm:col-span-2">
        <input name="address" defaultValue={property?.address ?? ""} className={inputCls} />
      </Field>
      <Field label="Notas" className="sm:col-span-2">
        <textarea name="notes" rows={2} defaultValue={property?.notes ?? ""} className={inputCls} />
      </Field>
      {!property && (
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="single" value="1" className="h-4 w-4 accent-caribe" />
          Se alquila completa (una casa o un local solo, sin divisiones)
        </label>
      )}
      <div className="sm:col-span-2">
        <SubmitButton>{property ? "Guardar cambios" : "Crear propiedad"}</SubmitButton>
      </div>
    </form>
  );
}

export function UnitForm({ propertyId, unit }: { propertyId: number; unit?: Unit }) {
  return (
    <form action={saveUnit} className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-3 sm:items-end">
      <input type="hidden" name="propertyId" value={propertyId} />
      {unit && <input type="hidden" name="id" value={unit.id} />}
      <Field label="Nombre">
        <input name="name" required defaultValue={unit?.name} placeholder="Ej. Apto 2B" className={inputCls} />
      </Field>
      <Field label="Tipo">
        <select name="type" defaultValue={unit?.type ?? "apartamento"} className={inputCls}>
          {UNIT_TYPES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Renta de referencia (RD$)">
        <input name="suggestedRent" inputMode="decimal" defaultValue={unit?.suggestedRent ?? ""} className={inputCls} />
      </Field>
      <Field label="Notas" className="sm:col-span-2">
        <input name="notes" defaultValue={unit?.notes ?? ""} className={inputCls} />
      </Field>
      <SubmitButton>{unit ? "Guardar unidad" : "Agregar unidad"}</SubmitButton>
    </form>
  );
}

export function TenantForm({
  tenant,
  next,
  unitId,
}: {
  tenant?: Tenant;
  next?: "contrato";
  unitId?: number;
}) {
  return (
    <form action={saveTenant} className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2">
      {tenant && <input type="hidden" name="id" value={tenant.id} />}
      {next && <input type="hidden" name="next" value={next} />}
      {unitId && <input type="hidden" name="unidad" value={unitId} />}
      <Field label="Nombre completo" className="sm:col-span-2">
        <input name="fullName" required defaultValue={tenant?.fullName} className={inputCls} />
      </Field>
      <Field label="Cédula o RNC">
        <input name="idNumber" defaultValue={tenant?.idNumber ?? ""} placeholder="000-0000000-0" className={inputCls} />
      </Field>
      <Field label="Teléfono / WhatsApp" hint="Ej. 809-555-1234">
        <input name="phone" type="tel" defaultValue={tenant?.phone ?? ""} className={inputCls} />
      </Field>
      <Field label="Correo" className="sm:col-span-2">
        <input name="email" type="email" defaultValue={tenant?.email ?? ""} className={inputCls} />
      </Field>
      <Field label="Notas" className="sm:col-span-2">
        <textarea name="notes" rows={2} defaultValue={tenant?.notes ?? ""} placeholder="Garante, referencias, vehículo…" className={inputCls} />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton>{tenant ? "Guardar cambios" : next ? "Registrar y seguir al contrato" : "Registrar inquilino"}</SubmitButton>
      </div>
    </form>
  );
}

type UnitOption = { id: number; name: string; propertyName: string; occupied: boolean; suggestedRent: string | null };

export function LeaseForm({
  lease,
  unitOptions,
  tenantOptions,
  defaultUnit,
  defaultTenant,
  today,
}: {
  lease?: Lease;
  unitOptions: UnitOption[];
  tenantOptions: { id: number; fullName: string }[];
  defaultUnit?: number;
  defaultTenant?: number;
  today: string;
}) {
  const unit = unitOptions.find((u) => u.id === (lease?.unitId ?? defaultUnit));
  const groups = new Map<string, UnitOption[]>();
  for (const u of unitOptions) groups.set(u.propertyName, [...(groups.get(u.propertyName) ?? []), u]);

  return (
    <form action={saveLease} className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2">
      {lease && <input type="hidden" name="id" value={lease.id} />}
      <Field label="Unidad">
        <select name="unitId" required defaultValue={lease?.unitId ?? defaultUnit ?? ""} className={inputCls}>
          <option value="" disabled>
            Elige la unidad…
          </option>
          {[...groups.entries()].map(([prop, us]) => (
            <optgroup key={prop} label={prop}>
              {us.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.occupied && u.id !== lease?.unitId ? " (ocupada)" : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>
      <Field label="Inquilino">
        <select name="tenantId" required defaultValue={lease?.tenantId ?? defaultTenant ?? ""} className={inputCls}>
          <option value="" disabled>
            Elige el inquilino…
          </option>
          {tenantOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.fullName}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Alquiler mensual (RD$)">
        <input
          name="monthlyRent"
          required
          inputMode="decimal"
          defaultValue={lease?.monthlyRent ?? unit?.suggestedRent ?? ""}
          className={`${inputCls} num`}
        />
      </Field>
      <Field label="Depósito (RD$)" hint="Opcional">
        <input name="deposit" inputMode="decimal" defaultValue={lease?.deposit ?? ""} className={`${inputCls} num`} />
      </Field>
      <Field label="Inicio del contrato">
        <input type="date" name="startDate" required defaultValue={lease?.startDate ?? today} className={inputCls} />
      </Field>
      <Field label="Fin del contrato" hint="Déjalo vacío si es indefinido">
        <input type="date" name="endDate" defaultValue={lease?.endDate ?? ""} className={inputCls} />
      </Field>
      <Field label="Cobrar desde el mes" hint="Si el contrato es viejo, elige desde cuándo registrar cuotas aquí">
        <input
          type="month"
          name="billingFrom"
          defaultValue={lease?.billingFrom ?? today.slice(0, 7)}
          className={inputCls}
        />
      </Field>
      <Field label="Día de pago de cada mes" hint="Si el mes tiene menos días, vence el último día">
        <input type="number" name="paymentDay" min={1} max={31} required defaultValue={lease?.paymentDay ?? 1} className={inputCls} />
      </Field>
      <Field label="Días de gracia" hint="Después de estos días se marca como atrasado">
        <input type="number" name="graceDays" min={0} max={60} defaultValue={lease?.graceDays ?? 5} className={inputCls} />
      </Field>
      <Field label="Notas" className="sm:col-span-2">
        <textarea name="notes" rows={2} defaultValue={lease?.notes ?? ""} placeholder="Condiciones especiales, mora acordada, garante…" className={inputCls} />
      </Field>
      {lease ? (
        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="applyFuture" value="1" defaultChecked className="mt-0.5 h-4 w-4 accent-caribe" />
          Aplicar el nuevo monto a las cuotas futuras que aún no tienen pagos
        </label>
      ) : (
        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="force" value="1" className="mt-0.5 h-4 w-4 accent-caribe" />
          Registrar aunque la unidad ya tenga otro contrato activo (ej. cuarto compartido)
        </label>
      )}
      <div className="sm:col-span-2">
        <SubmitButton>{lease ? "Guardar contrato" : "Crear contrato"}</SubmitButton>
      </div>
    </form>
  );
}
