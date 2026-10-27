import { backupNow, saveSettingsAction } from "@/app/actions";
import { formatDate } from "@/lib/dates";
import { driveStatus, folderUrl } from "@/lib/google";
import { getSettings } from "@/lib/settings";
import { SubmitButton } from "@/components/client";
import { btn, Field, Flash, inputCls, PageHeader, Panel, Section } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ajustes" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const [s, drive] = await Promise.all([getSettings(), driveStatus()]);

  return (
    <>
      <PageHeader title="Ajustes" />
      <Flash ok={sp.ok} error={sp.error} />

      <Section title="Google Drive y respaldos">
        <Panel className="p-4">
          <p className="text-sm">
            {drive.connected ? (
              <>
                Conectado con <span className="font-semibold">{drive.email}</span>. Los documentos, recibos y respaldos
                diarios se guardan en la carpeta “Gestión de Propiedades”.
              </>
            ) : (
              <span className="text-late">No conectado. Cierra sesión y vuelve a entrar aceptando el permiso de Drive.</span>
            )}
          </p>
          <p className="mt-2 text-sm text-muted">
            Último respaldo automático:{" "}
            {s.last_backup_at ? (
              <>
                {formatDate(s.last_backup_at.slice(0, 10))}
                {s.last_backup_url && (
                  <>
                    {" · "}
                    <a href={s.last_backup_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-caribe hover:underline">
                      ver archivo
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
              <SubmitButton pending="Respaldando…">Respaldar ahora en Drive</SubmitButton>
            </form>
            <a href="/api/respaldo" className={btn.secondary}>
              Descargar respaldo (JSON)
            </a>
            <a href="/api/respaldo?formato=csv" className={btn.secondary}>
              Descargar pagos (Excel/CSV)
            </a>
            {s.drive_root_folder_id && (
              <a href={folderUrl(s.drive_root_folder_id)} target="_blank" rel="noopener noreferrer" className={btn.secondary}>
                Abrir carpeta en Drive
              </a>
            )}
          </div>
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
