# Lista de SharePoint: `Facturas`

## Columnas

La columna `Title` que SharePoint crea sola se renombra a **IdUnico** y se usa
como llave del documento. No se borra: SharePoint no deja.

| Nombre interno | Tipo | Ajustes | Notas |
|---|---|---|---|
| `IdUnico` *(Title)* | Una línea de texto | **Exigir valores únicos** · **Indexada** · Obligatoria | La llave. Impide que la importación mensual duplique facturas ya cargadas |
| `NFactura` | Una línea de texto | | Número completo con prefijo: `FVE21642` |
| `FraAbr` | Una línea de texto | | Abreviatura que usa Cofinet |
| `TipoDocumento` | Elección | FACTURA, CUENTA_COBRO, NOTA_CREDITO, NOTA_DEBITO, OTRO | |
| `CUFE` | Una línea de texto | 255 caracteres | Lo trae solo la DIAN. Son 96 caracteres |
| `FechaEmision` | Fecha | Solo fecha | |
| `FechaRecepcion` | Fecha | Solo fecha | |
| `NIT` | Una línea de texto | **Indexada** | Sin puntos ni dígito de verificación |
| `Tercero` | Una línea de texto | | |
| `Total` | Número | 2 decimales | Hay importes con centavos: fletes y servicios portuarios |
| `Divisa` | Elección | COP, USD, EUR | Por defecto COP |
| `Area` | Elección | Ver abajo · **Indexada** | De esta columna depende quién ve qué |
| `Estado` | Elección | PENDIENTE, APROBADA, RECHAZADA · **Indexada** | Por defecto PENDIENTE |
| `Cbte` | Una línea de texto | | Comprobante de OASIS |
| `CbteOK` | Sí/No | Por defecto No · **Indexada** | |
| `CbteOKFecha` | Fecha y hora | | La escribe la app al marcar OK |
| `CbteOKUsuario` | Persona | | |
| `Observaciones` | Varias líneas de texto | Texto sin formato | |
| `FormaPago` | Una línea de texto | | |
| `EstadoPago` | Elección | PENDIENTE, PROGRAMADO, PAGADO, ANULADO | |
| `FechaAprobacion` | Fecha y hora | | |
| `AprobadoPor` | Persona | | |
| `MesPeriodo` | Una línea de texto | **Indexada** | `2026-09`. Es lo que permite filtrar por mes sin pasarse del límite |

El **documento soporte** va en los *datos adjuntos* nativos del elemento. No
hace falta columna ni biblioteca aparte, y Power Apps los maneja con el control
de adjuntos del formulario.

## Áreas

Estas son las áreas reales que aparecen en el archivo de septiembre, con la
cantidad de facturas de cada una:

```
COMERCIO EXTERIOR              135      GESTION HUMANA            20
CONTABILIDAD                   100      TRANSPORTE                16
PRODUCCION                      48      COMPRA CAFE (BENEFICIO)   14
COMPRAS SUMINISTROS Y OTROS     41      SISTEMAS                  11
COMPRA CAFE (PRODUCCION)        32      COMPRA NO CAFE            21
```

**Hay dos errores de digitación que conviene corregir antes de cargar**, porque
en una columna de elección se convierten en áreas nuevas y esas facturas no le
llegarían a nadie:

| Valor en el Excel | Debería ser | Filas |
|---|---|---|
| `COMPRAS SUMIINISTROS Y OTROS` | `COMPRAS SUMINISTROS Y OTROS` | 1 |
| `COMPRA CAFE (` | `COMPRA CAFE (PRODUCCION)` o `(BENEFICIO)` | 1 |

En la columna de elección, **desmarque "Permitir rellenar manualmente"**. Así
nadie puede inventar un área al editar.

## Lista `Aprobadores`

Quién aprueba cada área. Una fila por persona y área: alguien con dos áreas a
cargo tiene dos filas.

| Nombre interno | Tipo | Notas |
|---|---|---|
| `Title` → `Area` | Elección | Las mismas áreas |
| `Persona` | Persona | Con quien inicia sesión |
| `Rol` | Elección | APROBADOR, CONTABILIDAD, ADMIN |
| `Activo` | Sí/No | Por defecto Sí |

## El límite de 5.000 elementos

**Es la restricción más seria del diseño y hay que resolverla desde el principio.**

Una lista de SharePoint admite millones de elementos, pero **ninguna vista ni
consulta puede recorrer más de 5.000 sin una columna indexada que la filtre
antes**. Con el volumen real de Cofinet —unas 450 facturas al mes— la lista
pasa los 5.000 elementos **en poco menos de un año**.

Si no se previene, la app deja de mostrar datos y los flujos empiezan a fallar,
y ocurre de un día para otro.

Tres medidas, todas necesarias:

1. **Indexar `MesPeriodo`, `Area`, `Estado`, `CbteOK` y `NIT`** desde el día
   uno, con la lista vacía. Indexar una lista que ya pasó el límite es
   engorroso. SharePoint permite hasta 20 índices por lista.
2. **Ninguna vista sin filtro.** Toda vista debe empezar por una columna
   indexada que deje menos de 5.000 elementos: `MesPeriodo es igual a [mes
   actual]`, `Estado es igual a PENDIENTE`, etc.
3. **Archivar un año cerrado a Excel** y borrarlo de la lista. Es justamente el
   papel que se le dio a Excel en esta arquitectura, y mantiene la lista por
   debajo de unos 5.500 elementos. El flujo está en
   [`03-power-automate.md`](03-power-automate.md).

## Vistas

| Vista | Filtro | Para quién |
|---|---|---|
| **Pendientes del mes** | `MesPeriodo = [mes]` y `Estado = PENDIENTE` | Jefes de área |
| **Por contabilizar** | `Estado = APROBADA` y `CbteOK = No` | Contabilidad |
| **Sin área** | `Area está vacío` | Contabilidad, para clasificar |
| **Mes en curso** | `MesPeriodo = [mes]` | General |

Las vistas de SharePoint no filtran por usuario. La separación por área se hace
en Power Apps, no aquí: cualquiera con acceso a la lista puede ver todas las
filas entrando por el navegador. Si eso es un problema, hay que restringir el
acceso directo a la lista y dejar que todos entren por la app.
