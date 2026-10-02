# Plan de 3 días

Orden de trabajo para dejar el proceso funcionando. Cada paso dice qué hacer,
dónde y cuánto debería tomar.

**Qué significa "funcionando" al tercer día:** Contabilidad importa el archivo
del mes, cada jefe ve solo sus facturas y aprueba o rechaza, Contabilidad
registra el comprobante de OASIS y marca OK. Eso es el proceso completo.

Al final hay una lista de lo que queda para después y por qué no cabe.

---

## Día 0 — Antes de empezar (30 minutos)

**No se salte esto.** Son tres cosas que, si fallan, cuestan un día entero
descubrirlas a mitad de camino.

### 1. Permisos

Entre a https://make.powerapps.com y a https://make.powerautomate.com con su
cuenta. Si no puede crear una aplicación o un flujo, necesita que el
administrador del tenant le dé permisos de creador. **Eso puede tardar días**,
así que pídalo ahora.

Confirme también que puede crear una lista en el sitio de SharePoint donde va
a vivir esto.

### 2. Licencias

Abra un flujo nuevo y busque el conector **Aprobaciones**. Si aparece con un
rombo de *Premium*, el plan cambia: hay que usar tarjetas de Teams, o conseguir
licencias.

Pregunte a quien administra el tenant: *¿qué licencia de Microsoft 365 tenemos,
e incluye Power Automate premium?* La respuesta decide el diseño de los avisos.

> La notificación push dentro de la app de Power Apps **siempre** necesita
> conector premium. La tarjeta de Teams llega igual al celular y entra en la
> licencia normal. Ver [`03-power-automate.md`](03-power-automate.md).

### 3. Dónde va a vivir

Decida el sitio de SharePoint. Lo natural es el sitio del equipo de
Contabilidad, o uno nuevo llamado *Facturas*. Anote la URL: la va a usar todo
el tiempo.

---

## Día 1 — Los datos

Al terminar el día, la lista debe tener las 565 facturas de septiembre y poder
filtrarlas por área y por estado.

### 1.1 Limpiar el Excel (20 min)

Antes de cargar nada, en el Excel de Cofinet:

| Corregir | Dónde | Filas |
|---|---|---|
| `COMPRAS SUMIINISTROS Y OTROS` → `COMPRAS SUMINISTROS Y OTROS` | columna Area | 1 |
| `COMPRA CAFE (` → `COMPRA CAFE (PRODUCCION)` o `(BENEFICIO)` | columna Area | 1 |

Y revise las 4 filas que el conversor no pudo procesar (las nombra al correrlo):
dos cuentas de cobro repetidas, una sin NIT ni total, y una fila suelta al final.

**Por qué ahora:** un área mal escrita se convierte en una opción más de la
columna de elección, y esas facturas no le llegan a ningún jefe.

### 1.2 Crear la lista `Facturas` (60 min)

En el sitio de SharePoint: **Nuevo → Lista → Lista en blanco**, nómbrela
`Facturas`.

Cree las columnas de [`01-lista-sharepoint.md`](01-lista-sharepoint.md). Dos
cosas que no se pueden dejar para después:

- **Renombre `Title` a `IdUnico`** y márquela *Exigir valores únicos*. Es lo que
  impide que la importación mensual duplique lo ya cargado.
- En las columnas de elección (`Area`, `Estado`, `TipoDocumento`, `Divisa`,
  `EstadoPago`) **desmarque "Permitir rellenar manualmente"**.

### 1.3 Crear los índices (15 min)

**Configuración de la lista → Columnas indizadas**, y agregue:
`IdUnico`, `MesPeriodo`, `Area`, `Estado`, `CbteOK`, `NIT`.

> Hágalo con la lista vacía. Es rápido ahora y engorroso cuando la lista crece.
> Sin estos índices, la app empieza a mostrar datos incompletos en menos de un
> año y sin avisar. Ver el apartado del límite de 5.000 en
> [`01-lista-sharepoint.md`](01-lista-sharepoint.md).

### 1.4 Crear la lista `Aprobadores` (20 min)

Columnas en [`01-lista-sharepoint.md`](01-lista-sharepoint.md). Cargue una fila
por persona y área, con los correos reales. **Una persona con dos áreas a cargo
lleva dos filas.**

Revise que cada una de las 10 áreas tenga aprobador. Un área sin aprobador
significa facturas que no le llegan a nadie.

### 1.5 Convertir y cargar septiembre (90 min)

```bash
npx tsx scripts/exportar-sharepoint.mts "Cofinet - SEPTIEMBRE 2026.xlsx"
npx tsx scripts/exportar-sharepoint.mts "Reporte DIAN septiembre.xlsx"
```

Cargue **primero el histórico y después el de la DIAN**. Ese orden importa: el
histórico trae las decisiones ya tomadas y el de la DIAN solo refresca los
datos del documento.

Para cargar, lo más controlado es un flujo temporal de Power Automate:
*Enumerar filas presentes en una tabla* (tabla `Facturas`) → *Crear elemento*.
Déjelo correr; 565 filas toman unos minutos.

> La opción *Crear lista desde Excel* de SharePoint es más rápida pero adivina
> los tipos de columna y suele equivocarse con fechas y con la columna Sí/No.
> Con el flujo usted controla cada campo.

### 1.6 Verificar (30 min)

| Comprobación | Esperado |
|---|---|
| Total de elementos | 565 |
| Filtrando `Estado = PENDIENTE` | coincide con lo que reporta el conversor |
| Filtrando `Area = COMERCIO EXTERIOR` | 135 |
| Buscar una factura que esté en los dos archivos | **una sola fila**, no dos |

La última es la importante: confirma que la llave `IdUnico` está haciendo su
trabajo. Si aparecen duplicadas, pare y revise antes de seguir.

---

## Día 2 — Los flujos

### 2.1 Flujo de importación mensual (2-3 horas)

El del apartado *Flujo 1* de [`03-power-automate.md`](03-power-automate.md).

El punto delicado es la rama de actualización: **pase solo los campos del
documento** (tercero, total, fechas, CUFE). Si incluye `Estado` u
`Observaciones`, borra el trabajo del jefe de área en cada importación.

**Pruébelo así:** vuelva a correr el flujo con el mismo archivo de septiembre.
Debe reportar **0 nuevas**. Si crea filas, la llave no está funcionando.

### 2.2 Flujo de aviso y aprobación (2-3 horas)

El *Flujo 2*. Empiece por la variante de **resumen diario**, no por una
notificación por factura: con 450 al mes, el jefe de Comercio Exterior
recibiría 135 avisos y los va a ignorar.

Pruebe con **su propio usuario** como aprobador antes de involucrar a nadie.

### 2.3 Registrar la importación (1 hora)

Una lista `Importaciones` con archivo, usuario, fecha y los conteos. Es lo que
permite responder "¿esta factura entró, y cuándo?" sin adivinar.

---

## Día 3 — La aplicación

### 3.1 Crear la app (3-4 horas)

En https://make.powerapps.com: **Crear → Aplicación de lienzo → Desde datos**,
elija la lista `Facturas`.

Tres pantallas, con las fórmulas de [`04-power-apps.md`](04-power-apps.md):

1. **Facturas** — filtradas por el área del usuario conectado
2. **Detalle** — datos, observaciones, adjunto, Aprobar / Rechazar
3. **Contabilizar** — solo Contabilidad: comprobante y marca OK

**Lo primero que debe hacer es subir el límite de filas a 2.000**
(*Configuración → General → Límite de fila de datos*) y leer el apartado de
delegación. `Search()` y el operador `in` devuelven resultados incompletos sin
dar error.

### 3.2 Permisos y publicación (1 hora)

- Comparta la app con los jefes de área y con Contabilidad.
- Comparta la lista `Facturas` con los mismos, en modo **Colaborar**.
- Si no quiere que nadie edite la lista por el navegador saltándose las reglas
  de la app, restrinja el acceso directo: ver el final de
  [`01-lista-sharepoint.md`](01-lista-sharepoint.md).

### 3.3 Prueba con una persona real (1 hora)

Siéntese con **un** jefe de área —el de Sistemas tiene 11 facturas, es un buen
tamaño— y pídale que apruebe una y rechace otra, desde el celular.

Verifique después, en la lista: estado, quién aprobó, cuándo, y el motivo del
rechazo.

### 3.4 Capacitar (resto del día)

Media hora con los jefes de área: solo necesitan saber entrar, filtrar y
aprobar. Una hora con Contabilidad, que es quien importa y contabiliza.

---

## Lo que no cabe en 3 días

No es que sobre: es que **no hace falta todavía** y meterlo arriesga lo que sí
hace falta.

| Qué | Cuándo | Por qué se puede esperar |
|---|---|---|
| **Flujo de auditoría** | Semana 2 | Active el *historial de versiones* de la lista el día 1: guarda los cambios. El flujo lo vuelve consultable, que es distinto de registrarlo. |
| **Archivo anual a Excel** | Mes 10 | La lista no se acerca a los 5.000 hasta entonces. Pero **los índices del día 1 no son opcionales**: son los que hacen que esto sea un problema futuro y no uno inmediato. |
| **Recordatorios semanales** | Semana 2 | Útil, no esencial. |
| **Importar desde la app** | Opcional | Que Contabilidad deje el archivo en la biblioteca funciona igual. |
| **Herencia de área por NIT** | Semana 2-3 | Al principio Contabilidad clasifica a mano los que lleguen sin área. Automatizarlo ahorra tiempo después. |

---

## Si algo sale mal

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| La app no muestra todas las facturas | Delegación | Revise la fórmula: ¿usa `Search()` o `in`? Ver [`04-power-apps.md`](04-power-apps.md) |
| La importación crea duplicados | `IdUnico` no es único, o el flujo no lo busca antes de crear | Revise *Exigir valores únicos* y el filtro del paso 2.a |
| Una factura no le llega a nadie | Área vacía o mal escrita | Vista "Sin área" y la lista `Aprobadores` |
| El jefe aprobó pero el estado no cambió | El flujo escribió sobre el elemento | Revise qué campos pasa *Actualizar elemento* |
| El conector de Aprobaciones pide licencia | Premium | Cámbielo por tarjeta adaptativa de Teams |

**El plan B si se atrasan:** el día 3 es el que se puede recortar. Una lista
bien hecha con los flujos funcionando ya reemplaza el Excel, aunque la gente
entre por SharePoint en vez de por una app. La app se puede terminar la semana
siguiente sin frenar el proceso.

Lo que **no** se puede recortar es el día 1: una lista sin índices o sin llave
única hay que rehacerla, y con datos adentro cuesta mucho más.
