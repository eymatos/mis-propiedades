# Mis Propiedades

App web para administrar propiedades, unidades (apartamentos, locales, oficinas), inquilinos, contratos y cobros.
Funciona en el celular y la computadora.

## Qué hace

- **Propiedades y unidades**: edificios, plazas, casas o locales, cada uno con sus apartamentos/locales y su ocupación.
- **Inquilinos**: datos, cédula/RNC, teléfono de WhatsApp, contratos, deuda y documentos.
- **Contratos**: monto, día de pago, días de gracia, depósito y vigencia. Las **cuotas mensuales se generan solas**.
- **Cobros**: pagos completos o parciales, cargos extra (mantenimiento, agua, mora…), libro mensual.
- **Alertas**: atrasados y próximos a vencer en la pantalla de inicio, con botón para **avisar por WhatsApp** con el mensaje ya escrito. También contratos por vencer.
- **Recibos (volantes de pago)**: PDF con número, monto en letras y datos del pago, disponible siempre desde la app.
- **Documentos**: contratos, cédulas, títulos, fotos y comprobantes, guardados de forma privada.
- **Respaldos**: cada mañana se guarda una copia completa de los datos (se conservan las últimas 60). También puedes descargarla en JSON o los pagos en CSV para Excel.

## Dónde se guarda la información

| Qué | Dónde | Plan gratuito |
|---|---|---|
| Datos (propiedades, inquilinos, cobros) | Neon (PostgreSQL) | 0.5 GB, permanente, no se pausa |
| Documentos y respaldos | Vercel Blob (almacén privado) | 1 GB |
| La app | Vercel, plan Hobby | Gratis |

> Si Vercel Blob pasa de 1 GB, Vercel no cobra, pero bloquea los archivos por 30 días. Sube PDFs o fotos de tamaño normal y revisa el uso en Vercel → Storage de vez en cuando.

---

## Instalación en Vercel

### 1. Subir el código a GitHub
Sube el contenido de esta carpeta a tu repositorio (por ejemplo con `git push` desde VS Code).

### 2. Crear el proyecto en Vercel
En [vercel.com/new](https://vercel.com/new) importa el repositorio.

### 3. Conectar la base de datos (Neon)
Proyecto en Vercel → **Storage → Create Database → Neon** → plan **Free** → conéctala al proyecto.
Se agrega sola la variable `DATABASE_URL`.

### 4. Conectar el almacenamiento de archivos (Vercel Blob)
Proyecto en Vercel → **Storage → Create → Blob** → elige acceso **Private** → conéctalo al proyecto.
Se agrega sola la variable `BLOB_READ_WRITE_TOKEN`.

### 5. Poner tu contraseña
**Settings → Environment Variables** → agrega:

| Key | Value |
|---|---|
| `APP_PASSWORD` | La contraseña con la que vas a entrar a la app |

(Opcional) `CRON_SECRET` con cualquier texto aleatorio para proteger la tarea diaria.

### 6. Publicar
**Deployments** → los tres puntos del último → **Redeploy**. Abre la app y entra con tu contraseña.
Las tablas de la base de datos se crean solas la primera vez.

### 7. Instalarla en el celular
- **iPhone (Safari)**: Compartir → **Agregar a pantalla de inicio**.
- **Android (Chrome)**: menú ⋮ → **Instalar app** o **Agregar a pantalla principal**.

---

## Uso diario

1. **Inicio** te dice quién está atrasado y qué cobros vencen pronto. El botón verde abre WhatsApp con el mensaje listo.
2. Para cobrar: toca la cuota → **Registrar pago** → abre el recibo PDF → envía la confirmación por WhatsApp.
3. Los mensajes de WhatsApp, los datos del recibo y los días de aviso se cambian en **Ajustes**.

## Trabajar en tu computadora (opcional)

```bash
npm install
cp .env.example .env.local   # completa los valores
npm run dev                  # abre http://localhost:3000
```

## Estructura del código

```
src/
  app/(app)/         pantallas (inicio, cobros, propiedades, inquilinos, contratos, documentos, ajustes)
  app/api/           inicio de sesión, recibos PDF, subida y lectura de archivos, respaldo, tarea diaria
  app/actions.ts     acciones de los formularios (guardar, borrar, registrar pagos)
  lib/billing.ts     generación de cuotas, atrasos y mensajes de WhatsApp
  lib/storage.ts     archivos en Vercel Blob
  lib/receipt.ts     recibo en PDF
  lib/db/            esquema y creación automática de tablas
```
