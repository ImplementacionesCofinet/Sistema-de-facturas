# Sistema de facturas — Cofinet

Aplicación web de gestión y aprobación de facturas electrónicas DIAN y cuentas de cobro.
Reemplaza el proceso actual en Excel y se convierte en el **sistema de registro oficial**:
cada aprobación, rechazo, observación, adjunto y contabilización queda guardado con
usuario, fecha y hora exacta, sin depender del historial de versiones de un archivo.

## El proceso

1. **Contabilidad** importa en la app el Excel mensual descargado de la DIAN.
2. La app lee las filas, las normaliza y guarda solo las que aún no existen.
3. Cada **jefe de área** entra y ve únicamente las facturas de su área.
4. El jefe **aprueba o rechaza**, escribe observaciones y adjunta el documento soporte.
5. Contabilidad contabiliza en **OASIS**, vuelve a la app, registra el comprobante (Cbte)
   y lo marca como contabilizado (**OK**).
6. Todo queda en la tabla de **auditoría**: quién, cuándo, qué campo, valor anterior y nuevo.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend y backend | Next.js 15 (App Router, Server Components y Server Actions) + React 19 |
| Estilos | Tailwind CSS |
| Base de datos | PostgreSQL (compatible con Supabase, Neon, Railway, Render) |
| Autenticación | Microsoft Entra ID (OAuth 2.0 + PKCE) contra el tenant corporativo |
| Adjuntos | Azure Blob Storage o disco local |
| Lectura de Excel | ExcelJS (.xlsx / .xlsm) y lector propio de CSV |

Sin ORM: SQL explícito sobre `pg`, con migraciones versionadas en `db/migrations/`.

## Puesta en marcha

### 1. Requisitos

- Node.js 20 o superior
- PostgreSQL 14 o superior

### 2. Instalación

```bash
npm install
cp .env.example .env     # complete los valores
npm run db:migrate       # crea las tablas
npm run db:seed          # carga áreas y aprobadores iniciales
npm run dev              # http://localhost:3000
```

Antes de sembrar, ajuste la lista de áreas y correos reales en `scripts/seed.ts`.

### 3. Variables de entorno

Están todas documentadas en `.env.example`. Las imprescindibles:

| Variable | Para qué sirve |
|---|---|
| `DATABASE_URL` | Cadena de conexión a PostgreSQL |
| `SESSION_SECRET` | Firma la cookie de sesión (mínimo 32 caracteres) |
| `APP_URL` | URL pública; debe coincidir con el redirect URI de Azure |
| `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET` | Credenciales de Microsoft Entra ID |
| `ADMIN_EMAILS` | Correos que entran como ADMIN aunque la tabla `aprobadores` esté vacía |
| `STORAGE_DRIVER` | `local` o `azure` |

Genere el secreto de sesión con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 4. Registro en Microsoft Entra ID

En el portal de Azure, tenant `cofinetcomco.onmicrosoft.com`:

1. **Microsoft Entra ID → Registros de aplicaciones → Nuevo registro**.
2. Tipos de cuenta: *Solo cuentas de este directorio organizativo*.
3. **URI de redirección** (tipo *Web*): `{APP_URL}/api/auth/callback`
   (en desarrollo, `http://localhost:3000/api/auth/callback`).
4. En **Certificados y secretos**, cree un secreto de cliente y cópielo en `MS_CLIENT_SECRET`.
5. En **Permisos de API**, deje los delegados `openid`, `profile`, `email`, `User.Read`.
6. Copie *Id. de aplicación* en `MS_CLIENT_ID` y *Id. de directorio* en `MS_TENANT_ID`.

Sin Azure a mano, para desarrollo local ponga `DEV_AUTH=true` y entre solo con el correo.
Esa opción se desactiva sola cuando `NODE_ENV=production`.

## Roles

El rol sale de la tabla `aprobadores`, cruzando el correo con el que la persona inicia sesión.
Una persona puede tener varias filas si tiene varias áreas a cargo.

| Rol | Puede |
|---|---|
| `APROBADOR` | Ver solo las facturas de sus áreas; aprobar, rechazar, observar y adjuntar |
| `CONTABILIDAD` | Todo lo anterior en todas las áreas, además de importar, asignar área, registrar Cbte/OK, pagos y ver auditoría |
| `ADMIN` | Todo lo anterior, más administrar la tabla de aprobadores |

## Importación desde la DIAN

En **Importar DIAN** se sube el archivo mensual. La app:

- Busca la fila de encabezados aunque el archivo traiga filas de título encima.
- Reconoce los nombres de columna con o sin tildes, y distingue *NIT Emisor* de *NIT Receptor*.
- Interpreta montos en formato colombiano (`1.234.567,89`) y fechas `dd/mm/aaaa`.
- Normaliza el NIT quitando puntos y dígito de verificación.

### Identificador único

Evita duplicados entre importaciones sucesivas:

| Caso | `id_unico` |
|---|---|
| Factura con número | `NIT_NumFactura` — ej. `900123456_SETP9900` |
| Sin número pero con CUFE | `CUFE_<cufe>` |
| Cuenta de cobro | `CC_NIT_Fecha_Total` — ej. `CC_10203040_2026-06-25_1500000.00` |

### Dos modos

- **Importación mensual (DIAN)** — el habitual. Agrega las facturas nuevas y refresca los
  datos del documento (tercero, total, fechas). **Nunca** toca aprobaciones, observaciones,
  soportes ni comprobantes ya registrados. Volver a subir el mismo archivo no cambia nada.
- **Carga inicial del Excel histórico** — solo para la migración. Además de lo anterior,
  completa área, estado, comprobante y observaciones cuando esos campos aún están vacíos.

### Asignación de área

Si el archivo no trae área, la app reutiliza la última área con la que se clasificó ese
mismo NIT. Los proveedores recurrentes quedan asignados solos; los nuevos aparecen como
**Sin asignar** para que Contabilidad los clasifique.

> La DIAN entrega `.xlsx`. Si en algún caso entrega `.xls` (formato antiguo), ábralo en
> Excel y guárdelo como `.xlsx` antes de subirlo.

## Modelo de datos

- **`facturas`** — el registro oficial. `id_unico` es la llave de negocio.
- **`auditoria`** — una fila por cada campo modificado: usuario, fecha/hora, antes y después.
- **`aprobadores`** — quién aprueba cada área, con su rol.
- **`importaciones`** — una fila por archivo cargado, con el conteo de filas y las advertencias.
- **`areas`** — catálogo editable de áreas.

Esquema completo y comentado en [`db/migrations/001_init.sql`](db/migrations/001_init.sql).

## Reglas de negocio

- Rechazar exige escribir el motivo en observaciones.
- Solo se contabilizan facturas **aprobadas**; marcar OK exige número de comprobante.
- Una vez marcada OK, la decisión de aprobación queda congelada.
- Un jefe de área no puede ver ni modificar facturas de otra área, ni por listado ni por URL
  directa, ni tocar los campos de Contabilidad (área, Cbte, OK, pagos).
- Toda escritura sobre `facturas` pasa por un único punto que verifica permisos y escribe la
  auditoría dentro de la misma transacción.

## Comandos

```bash
npm run dev         # servidor de desarrollo
npm run build       # compilación de producción
npm start           # servidor de producción
npm run typecheck   # TypeScript sin emitir
npm test            # pruebas unitarias (Vitest)
npm run db:migrate  # aplica las migraciones pendientes
npm run db:seed     # carga áreas y aprobadores iniciales
```

## Pruebas

`npm test` cubre la parte más delicada: la normalización de montos, fechas, NIT y números
de factura, la construcción del `id_unico` y el reconocimiento de encabezados de la DIAN y
del Excel actual de Cofinet.

## Despliegue

### Vercel (recomendado, fullstack en un solo servicio)

1. Conecte el repositorio.
2. Cargue las variables de entorno del `.env.example`.
3. `APP_URL` = la URL de producción, y agregue `{APP_URL}/api/auth/callback` como redirect
   URI en Azure.
4. Use `STORAGE_DRIVER=azure`: el sistema de archivos de Vercel no es persistente.
5. Ejecute `npm run db:migrate` una vez contra la base de producción.

### Railway o Render

Mismo procedimiento. Con `STORAGE_DRIVER=local` monte un volumen persistente en
`STORAGE_LOCAL_DIR`; de lo contrario los adjuntos se pierden en cada despliegue.

### Base de datos

Sirve cualquier PostgreSQL gestionado. Con Supabase use la cadena del *Connection pooler*
(puerto 6543); el SSL se activa solo.

## Estructura

```
db/migrations/      Esquema SQL versionado
scripts/            Migraciones y semilla (tsx)
src/app/            Rutas, páginas y server actions
  (app)/            Área autenticada: facturas, contabilizar, importar, auditoría, aprobadores
  api/              Autenticación Microsoft, adjuntos y exportación CSV
src/components/     Componentes de interfaz
src/lib/            Dominio: BD, sesión, permisos, facturas, auditoría, importación
  import/           Lectura y normalización de Excel y CSV
tests/              Pruebas unitarias
```
