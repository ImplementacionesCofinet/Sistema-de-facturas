# Facturas Cofinet sobre Microsoft 365

Especificaciones para construir el proceso de aprobación de facturas con las
herramientas de Microsoft, en lugar del aplicativo web.

| Pieza | Para qué |
|---|---|
| **Lista de SharePoint** | Base de datos. Una fila por factura o cuenta de cobro. |
| **Power Apps** | Pantallas: el jefe de área revisa y aprueba; Contabilidad importa y contabiliza. |
| **Power Automate** | Importación mensual, avisos y aprobación desde Teams o correo. |
| **Excel** | Histórico: los años cerrados salen de la lista y quedan como archivo. |

## Qué hay en esta carpeta

| Archivo | Contenido |
|---|---|
| [`01-lista-sharepoint.md`](01-lista-sharepoint.md) | Columnas de la lista, tipos, índices, vistas y el límite de 5.000 elementos |
| [`02-reglas-de-negocio.md`](02-reglas-de-negocio.md) | Las reglas que hay que reimplementar, con los casos reales que las justifican |
| [`03-power-automate.md`](03-power-automate.md) | Los flujos, y qué entra en la licencia y qué no |
| [`04-power-apps.md`](04-power-apps.md) | Pantallas, fórmulas Power Fx y los límites de delegación |
| `datos/` | Los datos de septiembre de 2026 ya normalizados, listos para cargar |

## El conversor

Los dos archivos que maneja Contabilidad —el reporte de la DIAN y el Excel
histórico— tienen estructuras distintas y ninguno sirve tal cual para cargar en
una lista. El conversor los deja en un solo formato:

```bash
npx tsx scripts/exportar-sharepoint.mts "Reporte DIAN septiembre.xlsx"
```

Genera un `.xlsx` con una tabla de Excel llamada **`Facturas`**, con nombre
fijo. Eso importa: tanto *Crear lista desde Excel* de SharePoint como la acción
*Enumerar filas presentes en una tabla* de Power Automate trabajan sobre una
tabla con nombre, y **el archivo de la DIAN trae una tabla cuyo nombre cambia
cada mes** (`Rp_Doc_20260923_1641` lleva la fecha y hora de descarga), así que
un flujo que espere un nombre estable se rompe en la primera importación.

El conversor además informa, en cada corrida, los valores distintos de área,
estado y tipo de documento, y las filas que no pudo procesar con el motivo.

## Qué se conserva del trabajo anterior

El aplicativo web queda en la rama `claude/cofinet-invoice-approval-app-xrvczf`,
funcionando y probado, por si más adelante se retoma.

Lo que **no** hay que volver a descubrir es el comportamiento real de los
archivos: está en [`02-reglas-de-negocio.md`](02-reglas-de-negocio.md) y en el
conversor, verificado contra los archivos reales de agosto y septiembre de 2026.
Esa parte fue la que más trabajo costó y es independiente de la herramienta.
