import { matrizDesdeXlsx } from './xlsx';
import {
  esReporteDian,
  mapearColumnas,
  puntajeEncabezado,
  type CampoCanonico,
} from './headers';
import * as N from './normalize';
import type { EstadoFactura, TipoDocumento } from '@/lib/types';

/** Una fila del archivo ya normalizada y lista para guardarse. */
export interface FilaImportada {
  fila: number;
  id_unico: string;
  tipo_documento: TipoDocumento;
  n_factura: string | null;
  fra_abr: string | null;
  cufe: string | null;
  divisa: string | null;
  fecha_emision: string | null;
  fecha_recepcion: string | null;
  nit: string | null;
  tercero: string | null;
  total: number | null;
  area: string | null;
  estado: EstadoFactura;
  cbte: string | null;
  cbte_ok: boolean;
  observaciones: string | null;
  documento_ref: string | null;
  forma_pago: string | null;
  estado_pago: string | null;
  mes_periodo: string | null;
}

export interface ErrorFila {
  fila: number;
  motivo: string;
}

export interface ResultadoParseo {
  filas: FilaImportada[];
  errores: ErrorFila[];
  totalFilas: number;
  encabezadosReconocidos: CampoCanonico[];
  /** true cuando el archivo es el reporte de documentos recibidos de la DIAN. */
  esDian: boolean;
}

const MAX_FILAS_BUSQUEDA_ENCABEZADO = 20;

/**
 * Convierte una matriz de celdas (encabezados incluidos) en filas normalizadas.
 * Exportada aparte del lector de Excel para poder probarla sin archivos.
 */
export function normalizarMatriz(matriz: unknown[][]): ResultadoParseo {
  const errores: ErrorFila[] = [];

  // La DIAN antepone filas de titulo, asi que se busca la fila que mas
  // encabezados conocidos reconoce.
  let indiceEncabezado = -1;
  let mejorPuntaje = 0;
  const limite = Math.min(matriz.length, MAX_FILAS_BUSQUEDA_ENCABEZADO);
  for (let i = 0; i < limite; i++) {
    const puntaje = puntajeEncabezado(matriz[i] ?? []);
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      indiceEncabezado = i;
    }
  }

  if (indiceEncabezado === -1 || mejorPuntaje < 3) {
    return {
      filas: [],
      errores: [
        {
          fila: 0,
          motivo:
            'No se encontro una fila de encabezados reconocible. Se requieren al menos ' +
            'tres columnas conocidas (por ejemplo NIT, Nombre Emisor, Fecha Emision, Total).',
        },
      ],
      totalFilas: 0,
      encabezadosReconocidos: [],
      esDian: false,
    };
  }

  const columnas = mapearColumnas(matriz[indiceEncabezado]);
  const esDian = esReporteDian(matriz[indiceEncabezado]);
  const filas: FilaImportada[] = [];
  const vistos = new Set<string>();
  let totalFilas = 0;

  for (let i = indiceEncabezado + 1; i < matriz.length; i++) {
    const celdas = matriz[i] ?? [];
    const numeroFilaExcel = i + 1;

    const crudo = {} as Record<CampoCanonico, unknown>;
    for (const [indice, campo] of columnas) {
      crudo[campo] = celdas[indice] ?? null;
    }

    const vacia = Object.values(crudo).every(
      (v) => v === null || v === undefined || String(v).trim() === '',
    );
    if (vacia) continue;

    totalFilas++;

    const nFactura = N.numeroFactura(crudo.n_factura, crudo.prefijo, crudo.folio);
    // El folio sin prefijo es lo que permite reconocer la misma factura venga
    // del reporte de la DIAN o del Excel de Cofinet.
    const folio = N.folioClave(crudo.n_factura ?? nFactura, crudo.folio);
    const nitNorm = N.nit(crudo.nit);
    const fechaEmision = N.fecha(crudo.fecha_emision);
    const fechaRecepcion = N.fechaHora(crudo.fecha_recepcion);
    const total = N.numero(crudo.total);
    const cufe = N.texto(crudo.cufe);
    const tercero = N.texto(crudo.tercero);

    // Muchas cuentas de cobro llegan sin fecha de emision, solo con la de
    // recepcion. Sirve igual para identificarlas y para ubicarlas en su mes.
    const fechaClave = fechaEmision ?? fechaRecepcion?.slice(0, 10) ?? null;

    // El comprobante puede traer la marca de contabilizado dentro del texto.
    const comprobante = N.comprobante(crudo.cbte);

    const id = N.idUnico({
      nit: nitNorm,
      folio,
      fechaEmision: fechaClave,
      total,
      cufe,
    });

    const referencia = tercero ? ` (${tercero})` : '';

    if (!id) {
      const falta = [
        !nitNorm && 'NIT',
        !fechaClave && 'fecha',
        total === null && 'total',
      ].filter(Boolean);

      errores.push({
        fila: numeroFilaExcel,
        motivo:
          `No se pudo identificar el documento${referencia}: sin numero de factura ni CUFE, ` +
          `hacen falta ${falta.join(' y ')} para distinguirlo de otros. ` +
          'Complete ese dato en el archivo y vuelva a importar.',
      });
      continue;
    }

    if (vistos.has(id)) {
      errores.push({
        fila: numeroFilaExcel,
        motivo:
          `Documento repetido dentro del archivo${referencia}: coincide en NIT, fecha y total ` +
          'con una fila anterior. Se conservo la primera.',
      });
      continue;
    }
    vistos.add(id);

    filas.push({
      fila: numeroFilaExcel,
      id_unico: id,
      tipo_documento: N.tipoDocumento(crudo.tipo_documento, Boolean(nFactura)),
      divisa: N.divisa(crudo.divisa),
      n_factura: nFactura,
      fra_abr: N.texto(crudo.fra_abr),
      cufe,
      fecha_emision: fechaEmision,
      fecha_recepcion: fechaRecepcion,
      nit: nitNorm,
      tercero,
      total,
      area: N.area(crudo.area),
      // En el reporte de la DIAN, "Estado" es el acuse del documento
      // electronico, no la decision del jefe de area: toda factura recien
      // importada entra pendiente de aprobar.
      estado: esDian ? 'PENDIENTE' : N.estado(crudo.estado),
      cbte: comprobante.cbte,
      // Una columna "OK" aparte tiene prioridad; si no existe, vale la marca
      // que venga escrita dentro del propio comprobante.
      cbte_ok: N.booleano(crudo.cbte_ok) || comprobante.ok,
      observaciones: N.texto(crudo.observaciones),
      documento_ref: N.texto(crudo.documento_ref),
      forma_pago: esDian ? N.formaPagoDian(crudo.forma_pago) : N.texto(crudo.forma_pago),
      estado_pago: N.texto(crudo.estado_pago),
      mes_periodo: N.mesPeriodo(fechaClave),
    });
  }

  return {
    filas,
    errores,
    totalFilas,
    encabezadosReconocidos: Array.from(new Set(columnas.values())),
    esDian,
  };
}

/** Lector de CSV con comillas, para archivos exportados como texto. */
export function matrizDesdeCsv(contenido: string): unknown[][] {
  const texto = contenido.replace(/^﻿/, '');
  const primeraLinea = texto.split(/\r?\n/, 1)[0] ?? '';
  const delimitador =
    (primeraLinea.match(/;/g)?.length ?? 0) > (primeraLinea.match(/,/g)?.length ?? 0) ? ';' : ',';

  const matriz: unknown[][] = [];
  let fila: string[] = [];
  let campo = '';
  let enComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];

    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          enComillas = false;
        }
      } else {
        campo += c;
      }
      continue;
    }

    if (c === '"') {
      enComillas = true;
    } else if (c === delimitador) {
      fila.push(campo);
      campo = '';
    } else if (c === '\n') {
      fila.push(campo);
      matriz.push(fila);
      fila = [];
      campo = '';
    } else if (c !== '\r') {
      campo += c;
    }
  }

  if (campo !== '' || fila.length > 0) {
    fila.push(campo);
    matriz.push(fila);
  }

  return matriz;
}

/** Punto de entrada: detecta el formato por la extension del archivo. */
export async function parsearArchivo(
  nombreArchivo: string,
  buffer: Buffer,
): Promise<ResultadoParseo> {
  const esCsv = /\.csv$/i.test(nombreArchivo);
  const matriz = esCsv ? matrizDesdeCsv(buffer.toString('utf8')) : matrizDesdeXlsx(buffer);
  return normalizarMatriz(matriz);
}
