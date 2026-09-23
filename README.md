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
| Autenticación | Usuario y contraseña locales, o Microsoft Entra ID (OAuth 2.0 + PKCE) |
| Adjuntos | Azure Blob Storage o disco local |
| Lectura de Excel | ExcelJS (.xlsx / .xlsm) y lector propio de CSV |

Sin ORM: SQL explícito sobre `pg`, con migraciones versionadas en `db/migrations/`.

## Abrirlo en su computador (localhost)

### Lo que necesita instalado

- **Node.js 20 o superior** — https://nodejs.org (elija la versión LTS).
- **PostgreSQL 14 o superior** — https://www.postgresql.org/download/
  Durante la instalación le pedirá una contraseña para el usuario `postgres`:
  anótela, la va a necesitar.

Verifique que quedaron bien abriendo una terminal:

```bash
node --version      # debe decir v20 o superior
psql --version      # debe decir 14 o superior
```

### Paso a paso

```bash
# 1. Traer el código
git clone https://github.com/ImplementacionesCofinet/Sistema-de-facturas.git
cd Sistema-de-facturas
git checkout claude/cofinet-invoice-approval-app-xrvczf

# 2. Instalar las librerías
npm install

# 3. Crear la base de datos (le pedirá la contraseña de postgres)
createdb -U postgres cofinet_facturas

# 4. Generar el archivo de configuración con su correo
npm run preparar -- juan.garcia@cofinet.com.au

# 5. Crear las tablas y los datos iniciales
npm run db:migrate
npm run db:seed

# 6. Crear su contraseña (imprime una clave temporal: cópiela)
npm run clave juan.garcia@cofinet.com.au

# 7. Arrancar
npm run dev
```

Abra **http://localhost:3000** en el navegador y entre con su correo y la clave temporal
que imprimió el paso 6. La app le pedirá cambiarla de inmediato.

El paso 4 escribe un archivo `.env` con una clave de sesión aleatoria. Si su PostgreSQL usa
otro usuario o contraseña, edite la línea `DATABASE_URL` de ese archivo antes del paso 5:

```
DATABASE_URL=postgresql://USUARIO:CONTRASEÑA@localhost:5432/cofinet_facturas
```

### Si prefiere no instalar PostgreSQL (con Docker Desktop)

```bash
cp .env.produccion.example .env.produccion
# edite .env.produccion: ponga POSTGRES_PASSWORD, SESSION_SECRET,
# APP_URL=http://localhost:8080 y su correo en ADMIN_EMAILS

docker compose --env-file .env.produccion up -d --build
docker compose --env-file .env.produccion run --rm app node scripts/migrate.mjs
docker compose --env-file .env.produccion run --rm app node scripts/seed.mjs
docker compose --env-file .env.produccion run --rm app node scripts/clave.mjs juan.garcia@cofinet.com.au
```

Aquí la dirección es **http://localhost:8080** (no 3000), porque el contenedor publica ese
puerto.

### `SELF_SIGNED_CERT_IN_CHAIN` al construir la imagen

Es el caso más frecuente en una red corporativa. El cortafuegos de la empresa inspecciona
el tráfico HTTPS y lo vuelve a firmar con su propia CA. Windows confía en esa CA porque
está instalada en su almacén de certificados, pero **el contenedor no la conoce**, así que
rechaza la conexión y `npm` falla.

Se reconoce porque Docker sí descarga sus imágenes (usa la red de Windows) mientras que
`npm` dentro del contenedor no llega a ninguna parte. Para confirmarlo:

```bash
docker run --rm node:22-alpine npm ping
```

Si responde `SELF_SIGNED_CERT_IN_CHAIN`, exporte los certificados en los que ya confía
Windows y vuelva a construir:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\exportar-ca-windows.ps1
docker compose --env-file .env.produccion up -d --build
```

El script escribe `certs/ca-corporativa.crt`, que la construcción detecta sola. Ese archivo
no se sube al repositorio: cada empresa tiene el suyo, y donde no hay inspección de tráfico
no hace falta ninguno. Detalles en [`certs/LEEME.md`](certs/LEEME.md).

### Si la construcción va lentísima o npm falla

`npm ci` dentro de la imagen debería tardar entre uno y tres minutos. Si tarda diez o
veinte, o muere con `Exit handler never called!`, casi siempre es la **red del contenedor**,
no el código ni la memoria: los contenedores de Docker **no heredan la configuración de
proxy de Windows**, así que en una red corporativa quedan sin salida o con salida
degradada, mientras el navegador y el `npm` de Windows funcionan con normalidad.

Mida primero cuánto tarda un contenedor en alcanzar el registro de npm:

```bash
docker run --rm node:22-alpine npm ping
```

- Responde en pocos segundos → la red está bien; el problema es otro.
- Tarda mucho o falla → es la red del contenedor. Configure el proxy de la empresa en
  **Docker Desktop → Settings → Resources → Proxies**, active *Manual proxy configuration*
  y ponga la misma dirección que usa Windows. Luego *Apply & Restart*.

La dirección del proxy de Windows se consulta con:

```powershell
netsh winhttp show proxy
```

La construcción guarda la caché de npm entre intentos, así que aunque falle a medio camino
el siguiente intento reaprovecha lo ya descargado y avanza más.

### Memoria para construir la imagen

Compilar la aplicación (instalar dependencias y generar el build de Next) necesita
**al menos 4 GB de RAM** disponibles para Docker. Con menos, `npm` suele morir a mitad
con el mensaje `Exit handler never called!`, que no dice nada útil sobre la causa real.

En **Docker Desktop → Settings → Resources → Memory** suba el límite y aplique los cambios.
Si ya hay otros proyectos corriendo, deténgalos mientras se construye:

```bash
docker compose -p mesadeayuda stop      # o el nombre que tenga ese proyecto
```

Una vez construida la imagen, la app en marcha consume bastante menos; puede volver a
levantar los demás proyectos.

### Si ya tiene otros proyectos en Docker Desktop

Los dos pueden convivir sin tocarse. Este proyecto usa nombres propios para todo
(`cofinet-facturas`), su PostgreSQL **no publica ningún puerto** —solo lo alcanza la app— y
cada proyecto de Compose corre en su propia red.

Lo único que se comparte es el puerto con el que usted entra desde el navegador. Antes de
levantarlo, mire qué puertos están ocupados:

```bash
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

Si algo ya usa el 8080, cambie `PUERTO` en `.env.produccion` (por ejemplo `PUERTO=8090`),
vuelva a levantar y entre a `http://localhost:8090`.

Para no confundirse, conviene una carpeta por proyecto:

```
C:\dev\
  mesa-de-ayuda\
  facturas\          <- este proyecto
```

Cada carpeta tiene su propio `.env.produccion` y sus propios comandos; nada se pisa.

### Si algo falla

| Síntoma | Qué revisar |
|---|---|
| `connect ECONNREFUSED ...:5432` | PostgreSQL no está corriendo, o `DATABASE_URL` tiene otro puerto o contraseña. |
| `database "cofinet_facturas" does not exist` | Falta el paso 3 (`createdb`). |
| `Falta DATABASE_URL` | Falta el paso 4, o está ejecutando desde otra carpeta. |
| `relation "facturas" does not exist` | Falta el paso 5 (`npm run db:migrate`). |
| Entra al login pero dice «Correo o contraseña incorrectos» | Falta el paso 6, o la clave temporal ya se usó y se cambió. Vuelva a ejecutar `npm run clave <correo>`. |
| Dice «Su cuenta no está registrada como aprobador» | El correo no quedó en `ADMIN_EMAILS` (paso 4) ni en la tabla `aprobadores`. |
| `npm error Exit handler never called!` al construir la imagen | Docker se quedó sin memoria. Suba la RAM en **Docker Desktop → Settings → Resources** a 4 GB o más, cierre lo que no esté usando y repita. Ver abajo. |
| `Port 3000 is already in use` | Otra cosa ocupa el puerto: `npm run dev -- -p 3001` y abra `localhost:3001`. |

### Para que lo vean otros equipos de la red

`npm run dev` escucha solo en su computador. Para que entren desde otras máquinas:

```bash
npm run dev -- -H 0.0.0.0
```

Y entran a `http://<la-IP-de-su-equipo>:3000`. Para uso real de la empresa, en lugar de
esto use la instalación en el servidor que se describe más abajo.

## Configuración

### Variables de entorno

Están todas documentadas en `.env.example`. Las imprescindibles:

| Variable | Para qué sirve |
|---|---|
| `DATABASE_URL` | Cadena de conexión a PostgreSQL |
| `SESSION_SECRET` | Firma la cookie de sesión (mínimo 32 caracteres) |
| `APP_URL` | Dirección con la que se abre la app; con Azure debe coincidir con el redirect URI |
| `AUTH_MODE` | `local` (correo y contraseña), `entra` (Microsoft 365) o `ambos` |
| `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET` | Credenciales de Microsoft Entra ID |
| `ADMIN_EMAILS` | Correos que entran como ADMIN aunque la tabla `aprobadores` esté vacía |
| `STORAGE_DRIVER` | `local` o `azure` |

Genere el secreto de sesión con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### Registro en Microsoft Entra ID (opcional)

Solo hace falta si va a usar `AUTH_MODE=entra` o `ambos`. Para entrar con correo y
contraseña locales (`AUTH_MODE=local`) puede saltarse esta sección.

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
npm run db:respaldo # respaldo de la base con pg_dump
npm run clave <correo> [clave]   # crea o restablece una contraseña local
```

## Pruebas

`npm test` cubre la parte más delicada: la normalización de montos, fechas, NIT y números
de factura, la construcción del `id_unico`, el reconocimiento de encabezados de la DIAN y
del Excel actual de Cofinet, y el manejo de contraseñas.

Hay además pruebas de integración del inicio de sesión local (contraseña correcta e
incorrecta, cambio de contraseña, bloqueo por intentos fallidos, cuenta desactivada) que se
ejecutan solo si se les pasa una base de datos:

```bash
DATABASE_URL=postgresql://usuario:clave@localhost:5432/cofinet_pruebas npm test
```

Sin esa variable se omiten, para que `npm test` siga funcionando en un equipo sin
PostgreSQL.

## Despliegue en la red de la empresa

La instalación pensada es **dentro de la red de Cofinet**: la app corre en un servidor de
la oficina, la gente entra desde sus equipos por la LAN y nada se publica en internet.

### Qué se necesita

- Un servidor (físico o máquina virtual) encendido en horario laboral, con IP fija o
  nombre DNS interno.
- Docker Desktop (Windows Server) o Docker Engine (Linux). Si no se quiere Docker, ver más
  abajo la instalación directa.
- Puerto 8080 abierto en el firewall del servidor **solo para la red interna**.

### Opción A — Docker Compose (recomendada)

Levanta la app y su PostgreSQL juntos. La base de datos **no** se expone a la red: solo la
alcanza la aplicación.

```bash
# En el servidor, dentro de la carpeta del proyecto
cp .env.produccion.example .env.produccion    # complete los valores
docker compose --env-file .env.produccion up -d --build

# Crear las tablas la primera vez
docker compose --env-file .env.produccion run --rm app node scripts/migrate.mjs
docker compose --env-file .env.produccion run --rm app node scripts/seed.mjs

# Crear la contraseña del primer administrador
docker compose --env-file .env.produccion run --rm app node scripts/clave.mjs juan.garcia@cofinet.com.au
```

> El servidor usa `.env.produccion`, y el computador donde se desarrolla usa `.env`.
> Son archivos distintos a propósito: así no se mezcla la configuración de los dos.

El último comando imprime una clave temporal. Con ella se entra a
`http://<servidor>:8080`, la app obliga a cambiarla, y desde **Aprobadores** se registran
las demás personas y se les genera su propia clave temporal.

Comandos útiles:

```bash
docker compose --env-file .env.produccion ps            # estado de los servicios
docker compose --env-file .env.produccion logs -f app   # registro de la aplicación
docker compose --env-file .env.produccion down          # detener (los datos se conservan)
docker compose --env-file .env.produccion up -d --build # actualizar a una versión nueva
```

### Opción B — Sin Docker (Node y PostgreSQL instalados en el servidor)

```bash
npm ci
npm run build          # genera .next/standalone: el servidor ya empaquetado
npm run db:migrate
npm run db:seed
npm run clave juan.garcia@cofinet.com.au
npm start
```

Para que la app quede escuchando en la red y arranque sola con el servidor, se ejecuta la
salida *standalone* como servicio:

- **Windows:** registre `node .next\standalone\server.js` como servicio con
  [NSSM](https://nssm.cc/) o con el Programador de tareas (*Al iniciar el equipo*,
  ejecutar aunque no haya sesión iniciada). Defina las variables de entorno a nivel de
  sistema, más `PORT=8080` y `HOSTNAME=0.0.0.0`.
- **Linux:** cree una unidad de systemd con `ExecStart=/usr/bin/node /ruta/.next/standalone/server.js`
  y `Environment=` para cada variable.

Al compilar, copie también `.next/static` y `public` dentro de `.next/standalone/`
(así lo hace el `Dockerfile`).

### Inicio de sesión: local o Microsoft 365

En una red interna **sin HTTPS**, Microsoft Entra ID no sirve: solo acepta URLs de
redirección `https://` (salvo `localhost`), y además el servidor necesitaría salida a
internet. Por eso la app trae dos modos, con `AUTH_MODE`:

| `AUTH_MODE` | Cómo entra la gente | Requisitos |
|---|---|---|
| `local` *(por defecto en on-premise)* | Correo y contraseña guardados en la base de datos de la app | Ninguno |
| `entra` | Cuenta de Microsoft 365 | HTTPS con certificado de confianza + salida a internet |
| `ambos` | Ambas opciones en la pantalla de entrada | Los de `entra` |

Con `local`:

- Las contraseñas se guardan con **scrypt** y sal aleatoria; nunca en texto plano.
- Quien recibe una clave temporal **debe cambiarla** antes de poder usar la app.
- Tras 5 intentos fallidos seguidos la cuenta se bloquea 15 minutos
  (ajustable con `MAX_INTENTOS_LOGIN` y `MINUTOS_BLOQUEO_LOGIN`).
- Un administrador restablece claves desde **Aprobadores**. Si nadie puede entrar, Sistemas
  lo resuelve desde el servidor con `npm run clave <correo>`.

Cuando más adelante quieran pasar a Microsoft 365, basta publicar la app por HTTPS
(un proxy inverso con certificado de la CA interna de la empresa), registrar
`https://facturas.cofinet.local/api/auth/callback` en Azure y cambiar `AUTH_MODE=ambos`.
No hay que migrar datos: la autorización ya sale de la tabla `aprobadores` en los dos casos.

### Respaldos

La app pasa a ser el registro oficial de las facturas, así que el respaldo deja de ser
opcional.

```bash
# Con Docker
docker compose exec -T base-de-datos pg_dump -U cofinet -Fc cofinet_facturas > respaldos/facturas.dump

# Sin Docker (conserva 30 días y borra los más viejos)
npm run db:respaldo
```

Prográmelo a diario con el Programador de tareas de Windows o con `cron`, y copie la
carpeta `respaldos/` a otra máquina o al NAS. Los documentos soporte viven aparte: con
Docker, en el volumen `cofinet-facturas-adjuntos`; sin Docker, en `STORAGE_LOCAL_DIR`.
Respalde ambas cosas.

Para restaurar:

```bash
pg_restore --clean --if-exists -d "$DATABASE_URL" respaldos/facturas-<fecha>.dump
```

### Recomendaciones de red

- Asigne al servidor una IP fija y, si es posible, un nombre DNS interno
  (`facturas.cofinet.local`): así `APP_URL` no cambia si se mueve el servidor.
- Publique el puerto solo hacia la VLAN de usuarios; no lo exponga al router.
- La app confía en la red interna: no hay HTTPS por defecto, de modo que las contraseñas
  viajan por la LAN sin cifrar. Si esto preocupa, ponga delante un proxy inverso
  (Caddy, nginx o IIS) con un certificado de la CA interna; la app funciona igual.
- Si el servidor es también el de OASIS, use una máquina virtual aparte para no competir
  por recursos.

### Salud del servicio

`GET /api/salud` responde `{"estado":"ok","baseDeDatos":"ok"}` cuando todo está bien, y
503 si la app no alcanza la base. Sirve para el monitoreo de Sistemas y lo usa el
`HEALTHCHECK` de Docker.

### Más adelante, si lo quieren publicar

El proyecto también corre tal cual en Vercel, Railway o Render con PostgreSQL gestionado.
En ese caso use `STORAGE_DRIVER=azure` para los adjuntos (el disco de esos servicios no es
persistente) y `AUTH_MODE=entra`, que allí sí tiene HTTPS.

## Estructura

```
db/migrations/      Esquema SQL versionado
scripts/            Migraciones, semilla, contraseñas y respaldos (Node, sin compilar)
src/app/            Rutas, páginas y server actions
  (app)/            Área autenticada: facturas, contabilizar, importar, auditoría, aprobadores
  api/              Autenticación Microsoft, adjuntos y exportación CSV
src/components/     Componentes de interfaz
src/lib/            Dominio: BD, sesión, permisos, facturas, auditoría, importación
  import/           Lectura y normalización de Excel y CSV
tests/              Pruebas unitarias y de integración
Dockerfile          Imagen de la aplicación
docker-compose.yml  App + PostgreSQL para el servidor de la empresa
```
