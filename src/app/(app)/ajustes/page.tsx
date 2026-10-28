import { backupNow, saveSettingsAction } from "@/app/actions";
import { formatDate } from "@/lib/dates";
import { fileUrl } from "@/lib/storage";
import { getSettings } from "@/lib/settings";
import { SubmitButton } from "@/components/client";
import { btn, Field, Flash, inputCls, PageHeader, Panel, Section } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ajustes" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const s = await getSettings();

  return (
    <>
      <PageHeader title="Ajustes" />
      <Flash ok={sp.ok} error={sp.error} />

      <Section title="Respaldos">
        <Panel className="p-4">
          <p className="text-sm">
            Cada mañana se guarda automáticamente una copia completa de tus datos (se conservan las últimas 60).
          </p>
          <p className="mt-2 text-sm text-muted">
            Último respaldo:{" "}
            {s.last_backup_at ? (
              <>
                {formatDate(s.last_backup_at.slice(0, 10))}
                {s.last_backup_path && (
                  <>
                    {" · "}
                    <a href={fileUrl(s.last_backup_path, true)} className="font-semibold text-caribe hover:underline">
                      descargar
                    </a>
                  </>
                )}
              </>
            ) : (
              "todavía ninguno"
            )}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <form action={backupNow}>
              <SubmitButton pending="Respaldando…">Respaldar ahora</SubmitButton>
            </form>
            <a href="/api/respaldo" className={btn.secondary}>
              Descargar todo (JSON)
            </a>
            <a href="/api/respaldo?formato=csv" className={btn.secondary}>
              Descargar pagos (Excel/CSV)
            </a>
          </div>
          <p className="mt-3 text-xs text-muted">
            Te recomendamos descargar el respaldo una vez al mes y guardarlo en tu computadora o tu Drive personal.
          </p>
        </Panel>
      </Section>

      <form action={saveSettingsAction}>
        <Section title="Datos para los recibos">
          <Panel className="grid gap-3 p-4 sm:grid-cols-2">
            <Field label="Nombre o empresa">
              <input name="owner_name" defaultValue={s.owner_name} className={inputCls} />
            </Field>
            <Field label="Cédula o RNC">
              <input name="owner_id" defaultValue={s.owner_id} className={inputCls} />
            </Field>
            <Field label="Teléfono">
              <input name="owner_phone" defaultValue={s.owner_phone} className={inputCls} />
            </Field>
            <Field label="Próximo número de recibo">
              <input type="number" min={1} name="receipt_next" defaultValue={s.receipt_next} className={inputCls} />
            </Field>
            <Field label="Dirección" className="sm:col-span-2">
              <input name="owner_address" defaultValue={s.owner_address} className={inputCls} />
            </Field>
          </Panel>
        </Section>

        <Section title="Alertas y mensajes de WhatsApp">
          <Panel className="grid gap-3 p-4">
            <Field label="Avisar cobros que vencen en los próximos (días)">
              <input type="number" min={0} max={31} name="reminder_days" defaultValue={s.reminder_days} className={`${inputCls} max-w-32`} />
            </Field>
            <p className="text-sm text-muted">
              Puedes usar: {"{nombre}"} {"{monto}"} {"{pendiente}"} {"{concepto}"} {"{inmueble}"} {"{vence}"} {"{dias}"} {"{recibo}"}
            </p>
            <Field label="Recordatorio antes de vencer">
              <textarea name="tpl_recordatorio" rows={3} defaultValue={s.tpl_recordatorio} className={inputCls} />
            </Field>
            <Field label="Aviso de atraso">
              <textarea name="tpl_atraso" rows={3} defaultValue={s.tpl_atraso} className={inputCls} />
            </Field>
            <Field label="Confirmación de pago">
              <textarea name="tpl_confirmacion" rows={3} defaultValue={s.tpl_confirmacion} className={inputCls} />
            </Field>
          </Panel>
        </Section>

        <SubmitButton>Guardar ajustes</SubmitButton>
      </form>

      <Section title="Sesión" className="mt-10">
        <form action="/api/auth/logout" method="post">
          <button className={btn.secondary}>Cerrar sesión</button>
        </form>
      </Section>
    </>
  );
}
