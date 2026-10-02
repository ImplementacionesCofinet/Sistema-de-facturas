# Reglas de negocio

Todo lo de aquí salió de los archivos reales de agosto y septiembre de 2026, y
cada regla está porque algo falló sin ella. Son independientes de la
herramienta: valen igual en Power Apps que en cualquier otra cosa.

## 1. El `Estado` de la DIAN no es una aprobación

En el reporte de la DIAN, la columna **Estado** dice *"Aprobado con
notificación"* en todas las filas. Eso significa que el documento electrónico
se recibió y se acusó, **no** que el jefe de área haya autorizado el pago.

> Tomarlo por una aprobación da por aprobadas las 125 facturas del mes de una
> sola vez y se salta el proceso entero. Es el error más grave posible en esta
> migración.

**Regla:** toda factura que entra desde el reporte de la DIAN se crea en
`PENDIENTE`, sin importar lo que diga su columna Estado. La columna Estado del
Excel histórico de Cofinet sí es la decisión del jefe de área y se respeta.

Cómo distinguir los dos archivos: el de la DIAN trae columnas **NIT Receptor**,
**Nombre Receptor** y **CUFE/CUDE**; el de Cofinet no.

## 2. La llave `IdUnico`

Es lo que impide que la importación mensual duplique lo ya cargado.

| Caso | `IdUnico` | Ejemplo |
|---|---|---|
| Con folio | `NIT_folio` | `901570977_21642` |
| Sin folio, con CUFE | `CUFE_<cufe>` | |
| Cuenta de cobro | `CC_NIT_Fecha_Total` | `CC_10203040_2026-09-25_1500000.00` |

Se usa el **folio sin prefijo**, que es el dato que traen los dos archivos: la
DIAN entrega prefijo y folio por separado (`FVE` + `21642`) y el Excel de
Cofinet solo el folio (`21642`).

**No sirve quitarle las letras al número completo.** Hay prefijos que llevan
dígitos —`29FE`, `69DA`, `1`— y quedarían pegados al folio: la factura 27477
con prefijo 29FE daría `2927477` y no cruzaría. Son 4 facturas de septiembre.

**Contrastado con septiembre en los dos formatos:** de las 125 facturas del
reporte de la DIAN, 122 cruzan con el Excel. Las 3 restantes se emitieron el
mismo día en que se descargó el reporte.

## 3. El `OK` va dentro de la celda del comprobante

El Excel de Cofinet no tiene columna de contabilizado. La marca va escrita
dentro del propio comprobante, de varias formas:

```
CP5785 - OK        →  Cbte: CP5785          CbteOK: Sí
CP-6241 OK         →  Cbte: CP-6241         CbteOK: Sí
CP6115 / FP258 - OK→  Cbte: CP6115 / FP258  CbteOK: Sí
CP6212 - PDTE. APROBACIÓN →  texto completo, CbteOK: No
```

Son **297 facturas de agosto** que sin esta regla quedan sin marcar. Otras
anotaciones que no son un OK se conservan completas.

## 4. La columna del tercero se llama `TERCEROS`

En plural. Si el mapeo busca "Tercero" en singular, las 460 filas quedan sin
proveedor.

## 5. Cuentas de cobro sin fecha de emisión

Muchas llegan solo con fecha de recepción. Se usa esa como respaldo, tanto para
construir la llave como para ubicarlas en su período. Sin eso quedan fuera.

## 6. Importes con decimales y divisa

68 filas de agosto traen centavos: fletes y servicios portuarios. Redondearlos
convierte `6.131,07` en `6.131`. El reporte de la DIAN además informa la
divisa; el Excel de Cofinet no.

## 7. La forma de pago de la DIAN es un código

`1` es contado y `2` es crédito. Sin traducir, en la lista queda un "2" que no
le dice nada a nadie.

## 8. Dos modos de importación

| Modo | Qué hace |
|---|---|
| **Mensual (DIAN)** | Agrega las facturas nuevas y refresca los datos del documento: tercero, total, fechas. **Nunca** toca aprobaciones, observaciones, soportes ni comprobantes ya registrados. Volver a subir el mismo archivo no cambia nada. |
| **Carga inicial** | Además completa área, estado, comprobante y observaciones **cuando esos campos aún están vacíos**. Solo para la migración. |

Que el modo mensual no pise lo ya decidido es lo que permite importar sin miedo
cada mes. Si un flujo de Power Automate actualiza el elemento completo, borra
el trabajo del jefe de área.

## 9. Filas que no se pueden procesar

Cuando falta un dato para identificar el documento, la fila no entra y hay que
corregirla en el origen. En septiembre fueron 4 de 444:

- 2 cuentas de cobro repetidas: coinciden en NIT, fecha y total con otra fila.
- 1 cuenta de cobro sin NIT ni total.
- 1 fila suelta al final del archivo.

El mensaje debe nombrar al tercero y el dato que falta. "No se pudo construir
el identificador" no le sirve a quien tiene que arreglarlo.

## 10. Área sin asignar

Si el archivo no trae área —el de la DIAN nunca la trae— conviene heredar la
última área con la que se clasificó ese mismo NIT. Los proveedores recurrentes
quedan asignados solos y Contabilidad revisa únicamente los nuevos.

Lo que no se pueda resolver queda sin área y **no le llega a ningún jefe**, así
que la vista "Sin área" de Contabilidad no es opcional.
