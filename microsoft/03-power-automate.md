# Flujos de Power Automate

## Antes de empezar: qué entra en la licencia

Esto decide el diseño, así que conviene verificarlo con quien administra el
tenant antes de construir nada.

| Conector | Licencia | Uso aquí |
|---|---|---|
| SharePoint | Estándar | Leer y escribir la lista |
| Excel Online (Business) | Estándar | Leer el archivo importado |
| Office 365 Outlook | Estándar | Avisos por correo |
| Microsoft Teams | Estándar | Tarjeta de aprobación |
| **Aprobaciones** | Estándar | *Iniciar y esperar una aprobación* |
| **Power Apps Notification V2** | **Premium** | Notificación push a la app móvil |

**Sobre los "push ups para aprobar":** la notificación push *dentro de la app
de Power Apps* necesita un conector premium, con licencia aparte por usuario.

La alternativa sin costo adicional es la **tarjeta adaptativa de Teams** o el
conector de **Aprobaciones**: el jefe recibe la notificación push de Teams en
el celular —que es una notificación push real— y aprueba o rechaza desde ahí,
sin abrir ninguna app. Es además donde la gente ya está.

Recomendación: empezar por Teams/Aprobaciones y dejar el push de Power Apps
para después, si resulta que hace falta.

---

## Flujo 1 — Importación mensual

**Disparador:** *Para un elemento seleccionado* en la biblioteca donde
Contabilidad deja el archivo, o manual.

**El archivo tiene que venir del conversor.** El reporte que descarga la DIAN
trae una tabla cuyo nombre cambia cada mes (`Rp_Doc_20260923_1641`), y la
acción *Enumerar filas presentes en una tabla* necesita un nombre fijo. El
conversor deja siempre una tabla llamada `Facturas`.

```
1. Enumerar filas presentes en una tabla   (tabla: Facturas)
2. Para cada fila:
   a. Obtener elementos  (lista Facturas, Filtrar: IdUnico eq '<IdUnico>', Superior: 1)
   b. ¿Está vacío el resultado?
      SÍ  → Crear elemento     (todos los campos; Estado = PENDIENTE)
      NO  → Actualizar elemento, SOLO los campos del documento:
            NFactura, FraAbr, CUFE, FechaEmision, FechaRecepcion,
            NIT, Tercero, Total, Divisa, MesPeriodo
3. Registrar el resumen en la lista Importaciones
```

**El paso 2.b es el que hay que cuidar.** *Actualizar elemento* en Power
Automate escribe todos los campos que se le pasen: si se le pasa `Estado`,
borra la decisión del jefe de área. Deje esos campos fuera de la acción.

El filtro `IdUnico eq '...'` es delegable porque la columna está indexada.

> Alternativa más rápida: en vez de recorrer fila por fila, use *Enviar una
> solicitud HTTP a SharePoint* con un lote (`$batch`). Con 450 filas al mes, el
> bucle simple tarda unos minutos y es más fácil de mantener; vale la pena solo
> si llega a molestar.

---

## Flujo 2 — Aviso y aprobación

**Disparador:** *Cuando se crea un elemento* en la lista Facturas.

```
1. Condición: Estado = PENDIENTE y Area no está vacío
2. Obtener elementos  (lista Aprobadores, Filtrar: Area eq '<Area>' y Activo eq 1)
3. ¿Hay aprobador?
   NO → Avisar a Contabilidad: "factura sin aprobador asignado"
   SÍ → Iniciar y esperar una aprobación
        Tipo: Aprobar/Rechazar - Primera respuesta
        Asignado a: <Persona del aprobador>
        Título: "<Tercero> — <Total> <Divisa>"
        Detalles: factura, fecha, área, observaciones, enlace al elemento
4. Según el resultado:
   Aprobar  → Actualizar elemento: Estado=APROBADA, FechaAprobacion=utcNow(),
              AprobadoPor=<quien respondió>, Observaciones=<comentario>
   Rechazar → Igual, con Estado=RECHAZADA
```

**Rechazar exige motivo.** El conector de Aprobaciones no lo hace obligatorio,
así que hay que validarlo después: si rechaza sin comentario, pedirlo por
Teams o dejar la factura en PENDIENTE con un aviso. Si no, se pierde el por qué
del rechazo, que es justo lo que se quiere registrar.

**Un aviso por factura es demasiado.** Con 450 al mes, un jefe de Comercio
Exterior recibiría 135 notificaciones. Mejor un **resumen diario**: un flujo
programado que agrupe las pendientes de cada área y mande una sola tarjeta con
el listado y un enlace a la app.

---

## Flujo 3 — Recordatorio de pendientes

**Disparador:** programado, lunes a las 8:00 (hora de Bogotá).

```
1. Obtener elementos (Facturas, Filtrar: Estado eq 'PENDIENTE')
2. Agrupar por Area
3. Por cada área con pendientes:
   - Buscar el aprobador
   - Publicar tarjeta adaptativa en Teams con el conteo, el monto y el enlace
```

---

## Flujo 4 — Auditoría

El historial de versiones de SharePoint guarda los cambios, pero no se puede
consultar ni filtrar con comodidad. Para que la auditoría sirva de verdad, una
lista aparte:

**Lista `Auditoria`:** `IdUnicoRef`, `Tercero`, `Area`, `Usuario`, `Campo`,
`ValorAnterior`, `ValorNuevo`, `Fecha`.

**Disparador:** *Cuando se crea o modifica un elemento*.

Power Automate no entrega el valor anterior: hay que leer el elemento antes de
escribir, o guardar un JSON del estado previo en una columna oculta y comparar.
La segunda opción es más sencilla de mantener.

Active también el **historial de versiones** de la lista. Es la red de
seguridad si el flujo de auditoría falla.

---

## Flujo 5 — Archivar un año a Excel

Lo que mantiene la lista por debajo del límite de 5.000 elementos. Ver
[`01-lista-sharepoint.md`](01-lista-sharepoint.md).

**Disparador:** programado, una vez al año, o manual.

```
1. Obtener elementos (Facturas, Filtrar: MesPeriodo ge '2026-01' y MesPeriodo le '2026-12')
   — paginación activada, 5.000 por página
2. Crear un .xlsx en la biblioteca de históricos y escribir las filas
3. Verificar el conteo contra la lista
4. Solo si cuadra: eliminar esos elementos de la lista
```

**El paso 3 no es opcional.** Borrar antes de confirmar que el archivo quedó
completo deja sin respaldo lo que se acaba de eliminar.
