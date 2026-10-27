# Mis Propiedades

App web para administrar propiedades, unidades (apartamentos, locales, oficinas), inquilinos, contratos y cobros.
Funciona en el celular y la computadora, y guarda los documentos y respaldos en **tu propio Google Drive**.

## Qué hace

- **Propiedades y unidades**: edificios, plazas, casas o locales, cada uno con sus apartamentos/locales y su ocupación.
- **Inquilinos**: datos, cédula/RNC, teléfono de WhatsApp, contratos, deuda y documentos.
- **Contratos**: monto, día de pago, días de gracia, depósito y vigencia. Las **cuotas mensuales se generan solas**.
- **Cobros**: registro de pagos completos o parciales, cargos extra (mantenimiento, agua, mora…), libro mensual.
- **Alertas**: atrasados y próximos a vencer en la pantalla de inicio, con botón para **avisar por WhatsApp** con el mensaje ya escrito. También contratos por vencer.
- **Recibos (volantes de pago)**: PDF con número, monto en letras y datos del pago. Se guardan automáticamente en Drive, en la carpeta del inquilino.
- **Documentos**: contratos, cédulas, títulos, fotos, comprobantes… subidos directo a Drive y organizados por inquilino o propiedad.
- **Respaldos**: cada mañana se guarda una copia completa de los datos en Drive (y el día 1 de cada mes, una hoja de pagos en CSV para Excel). También puedes descargarlos cuando quieras desde Ajustes.

## Dónde se guarda la información

| Qué | Dónde | Costo |
|---|---|---|
| Datos (propiedades, inquilinos, cobros) | Neon (PostgreSQL), plan gratuito permanente | Gratis |
| Documentos, recibos PDF y respaldos | Tu Google Drive, carpeta "Gestión de Propiedades" | Gratis (15 GB de tu cuenta) |
| La app | Vercel, plan Hobby | Gratis |

La app solo tiene permiso sobre los archivos que ella misma crea en tu Drive; no puede ver el resto de tus archivos.

---

## Instalación paso a paso (unos 30 minutos, sin programar)

Necesitas: una cuenta de Google, una de GitHub y una de Vercel (puedes crear Vercel entrando con GitHub).

### 1. Subir el código a GitHub

1. Entra a [github.com/new](https://github.com/new), ponle un nombre (ej. `mis-propiedades`), márcalo **Private** y crea el repositorio.
2. En la página del repositorio vacío, haz clic en **uploading an existing file**.
3. Descomprime el `.zip` en tu computadora y **arrastra todo el contenido de la carpeta** (no la carpeta en sí) a la página. Haz clic en **Commit changes**.

### 2. Crear las credenciales de Google (para entrar y usar Drive)

1. Entra a [console.cloud.google.com](https://console.cloud.google.com) y crea un proyecto nuevo (ej. "Mis Propiedades").
2. Ve a **APIs y servicios → Biblioteca**, busca **Google Drive API** y haz clic en **Habilitar**.
3. Ve a **APIs y servicios → Pantalla de consentimiento de OAuth** (o "Google Auth Platform"):
   - Tipo de usuario: **Externo**. Nombre de la app: "Mis Propiedades". Pon tu correo como soporte y contacto.
   - En **Permisos / Data access**, agrega el permiso `.../auth/drive.file`.
   - En **Público / Audience**, haz clic en **Publicar app** (pasar a "En producción").
     > Importante: si se queda en modo "Prueba", Google desconecta Drive cada 7 días.
4. Ve a **Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo: **Aplicación web**.
   - En **URI de redireccionamiento autorizados** agrega por ahora `http://localhost:3000/api/auth/callback` (en el paso 4 agregas la de Vercel).
   - Guarda el **ID de cliente** y el **Secreto de cliente**.

### 3. Publicar en Vercel con la base de datos Neon

1. En [vercel.com/new](https://vercel.com/new) importa el repositorio de GitHub. **No lo despliegues todavía** si te deja configurar variables; si se despliega y falla, no pasa nada.
2. En el proyecto de Vercel ve a **Storage → Create Database → Neon** (Serverless Postgres), plan **Free**, y conéctala al proyecto. Esto agrega sola la variable `DATABASE_URL`.
3. Ve a **Settings → Environment Variables** y agrega:

| Variable | Valor |
|---|---|
| `GOOGLE_CLIENT_ID` | El ID de cliente del paso 2 |
| `GOOGLE_CLIENT_SECRET` | El secreto de cliente del paso 2 |
| `ALLOWED_EMAILS` | Tu correo de Gmail (puedes poner varios separados por coma) |
| `AUTH_SECRET` | Un texto aleatorio de 32+ caracteres (usa un generador de contraseñas) |
| `CRON_SECRET` | Otro texto aleatorio |

4. Ve a **Deployments**, abre el último y haz clic en **Redeploy**.

### 4. Conectar la dirección de Vercel con Google

1. Copia la dirección de tu app (ej. `https://mis-propiedades.vercel.app`).
2. En Google Cloud → **Credenciales** → tu ID de cliente, agrega el URI de redireccionamiento:
   `https://mis-propiedades.vercel.app/api/auth/callback` y guarda.

### 5. Entrar por primera vez

1. Abre tu app y toca **Entrar con Google**.
2. Como la app es tuya y no está "verificada" por Google, verás un aviso. Toca **Configuración avanzada → Ir a Mis Propiedades**. Es normal en apps personales.
3. Acepta el permiso de Drive. Las tablas de la base de datos se crean solas.

### 6. Instalarla en el celular

- **iPhone (Safari)**: botón Compartir → **Agregar a pantalla de inicio**.
- **Android (Chrome)**: menú ⋮ → **Instalar app** o **Agregar a pantalla principal**.

---

## Uso diario

1. **Inicio** te dice quién está atrasado y qué cobros vencen pronto. El botón verde abre WhatsApp con el mensaje listo.
2. Para cobrar: toca la cuota → **Registrar pago** → se genera el recibo PDF y se guarda en Drive → envía la confirmación por WhatsApp.
3. Los mensajes de WhatsApp, los datos del recibo y los días de aviso se cambian en **Ajustes**.

## Respaldo y recuperación

- Cada día a las 7:00 a. m. (hora RD) se guarda `respaldo-AAAA-MM-DD.json` en Drive → `Gestión de Propiedades/Respaldos/`.
- En Ajustes puedes **Respaldar ahora**, o descargar el respaldo completo (JSON) y la lista de pagos (CSV para Excel).
- Neon guarda la base de datos de forma permanente en el plan gratuito; no se pausa ni se borra por falta de uso.

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
  app/api/           login con Google, recibos PDF, subida a Drive, respaldo, tarea diaria
  app/actions.ts     acciones de los formularios (guardar, borrar, registrar pagos)
  lib/billing.ts     generación de cuotas, atrasos y mensajes de WhatsApp
  lib/google.ts      conexión con Google Drive
  lib/receipt.ts     recibo en PDF
  lib/db/            esquema y creación automática de tablas
```
