import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parsearArchivo } from '../src/lib/import/parse';
import { escribirXlsx, type Celda } from '../src/lib/import/escribir-xlsx';

/**
 * Convierte cualquiera de los dos archivos que maneja Cofinet —el reporte de
 * la DIAN o el Excel historico— al formato que espera la lista de SharePoint.
 *
 *   npx tsx scripts/exportar-sharepoint.mts <entrada.xlsx> [salida.xlsx]
 *
 * La salida lleva una tabla de Excel llamada "Facturas", con nombre fijo, que
 * es lo que necesitan tanto "Crear lista desde Excel" como la accion de Power
 * Automate que lee filas de una tabla.
 *
 * Aqui se aplica toda la normalizacion que costo descubrir con los archivos
 * reales: el encabezado TERCEROS en plural, la marca OK escrita dentro de la
 * celda del comprobante, el acuse de la DIAN que no es una aprobacion, el
 * folio sin prefijo como llave, y las cuentas de cobro sin fecha de emision.
 */

const COLUMNAS = [
  'IdUnico', 'NFactura', 'FraAbr', 'TipoDocumento', 'CUFE',
  'FechaEmision', 'FechaRecepcion', 'NIT', 'Tercero', 'Total', 'Divisa',
  'Area', 'Estado', 'Cbte', 'CbteOK', 'Observaciones',
  'FormaPago', 'EstadoPago', 'MesPeriodo',
];

async function main() {
  const entrada = process.argv[2];
  if (!entrada) {
    console.error('Uso: npx tsx scripts/exportar-sharepoint.mts <entrada.xlsx> [salida.xlsx]');
    process.exit(1);
  }

  const salida =
    process.argv[3] ??
    path.join('microsoft/datos', `${path.basename(entrada, path.extname(entrada))}-SharePoint.xlsx`);

  const parseo = await parsearArchivo(entrada, readFileSync(entrada));

  const filas: Celda[][] = parseo.filas.map((f) => [
    f.id_unico,
    f.n_factura,
    f.fra_abr,
    f.tipo_documento,
    f.cufe,
    f.fecha_emision,
    // Solo la fecha: una lista de SharePoint con hora complica el filtrado y
    // la hora de recepcion no se usa para decidir nada.
    f.fecha_recepcion?.slice(0, 10) ?? null,
    f.nit,
    f.tercero,
    f.total,
    f.divisa ?? 'COP',
    f.area,
    f.estado,
    f.cbte,
    f.cbte_ok ? 'SI' : 'NO',
    f.observaciones,
    f.forma_pago,
    f.estado_pago,
    f.mes_periodo,
  ]);

  writeFileSync(salida, escribirXlsx({ nombreTabla: 'Facturas', encabezados: COLUMNAS, filas }));

  console.log(`\nOrigen reconocido: ${parseo.esDian ? 'reporte de la DIAN' : 'Excel historico de Cofinet'}`);
  console.log(`Filas leidas:      ${parseo.totalFilas}`);
  console.log(`Filas exportadas:  ${filas.length}`);
  console.log(`Archivo:           ${salida}`);

  if (parseo.errores.length > 0) {
    console.log(`\nFilas que quedaron fuera (${parseo.errores.length}), hay que corregirlas en el origen:`);
    for (const e of parseo.errores) console.log(`  Fila ${e.fila}: ${e.motivo}`);
  }

  // Valores distintos de las columnas de eleccion: son los que hay que
  // registrar en la lista de SharePoint.
  const distintos = (campo: 'area' | 'estado' | 'tipo_documento' | 'divisa' | 'estado_pago') =>
    [...new Set(parseo.filas.map((f) => f[campo]).filter(Boolean))].sort();

  console.log('\nValores para las columnas de eleccion de la lista:');
  for (const campo of ['area', 'estado', 'tipo_documento', 'divisa', 'estado_pago'] as const) {
    const valores = distintos(campo);
    console.log(`  ${campo}: ${valores.length ? valores.join(' | ') : '(ninguno)'}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
