import ExcelJS from 'exceljs';
import { mapearColumnas, puntajeEncabezado, type CampoCanonico } from './headers';
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
}

/** exceljs devuelve objetos para formulas, hipervinculos y texto enriquecido. */
export function valorCelda(valor: unknown): unknown {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) return valor;
  if (typeof valor === 'object') {
    const v = valor as Record<string, unknown>;
    if ('text' in v) return v.text;
    if ('result' in v) return v.result;
    if ('richText' in v && Array.isArray(v.richText)) {
      return (v.richText as { text?: string }[]).map((p) => p.text ?? '').join('');
    }
    if ('hyperlink' in v) return v.hyperlink;
    if ('error' in v) return null;
  }
  return valor;
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
    };
  }

  const columnas = mapearColumnas(matriz[indiceEncabezado]);
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
    const nitNorm = N.nit(crudo.nit);
    const fechaEmision = N.fecha(crudo.fecha_emision);
    const total = N.numero(crudo.total);
    const cufe = N.texto(crudo.cufe);

    const id = N.idUnico({
      nit: nitNorm,
      numeroFactura: nFactura,
      fechaEmision,
      total,
      cufe,
    });

    if (!id) {
      errores.push({
        fila: numeroFilaExcel,
        motivo:
          'No se pudo construir el identificador unico: se requiere numero de factura, ' +
          'o CUFE, o bien NIT + fecha de emision + total.',
      });
      continue;
    }

    if (vistos.has(id)) {
      errores.push({
        fila: numeroFilaExcel,
        motivo: `Fila duplicada dentro del mismo archivo (${id}). Se conservo la primera.`,
      });
      continue;
    }
    vistos.add(id);

    filas.push({
      fila: numeroFilaExcel,
      id_unico: id,
      tipo_documento: N.tipoDocumento(crudo.tipo_documento, Boolean(nFactura)),
      n_factura: nFactura,
      fra_abr: N.texto(crudo.fra_abr),
      cufe,
      fecha_emision: fechaEmision,
      fecha_recepcion: N.fechaHora(crudo.fecha_recepcion),
      nit: nitNorm,
      tercero: N.texto(crudo.tercero),
      total,
      area: N.area(crudo.area),
      estado: N.estado(crudo.estado),
      cbte: N.texto(crudo.cbte),
      cbte_ok: N.booleano(crudo.cbte_ok),
      observaciones: N.texto(crudo.observaciones),
      documento_ref: N.texto(crudo.documento_ref),
      forma_pago: N.texto(crudo.forma_pago),
      estado_pago: N.texto(crudo.estado_pago),
      mes_periodo: N.mesPeriodo(fechaEmision),
    });
  }

  return {
    filas,
    errores,
    totalFilas,
    encabezadosReconocidos: Array.from(new Set(columnas.values())),
  };
}

/** Lee un .xlsx/.xlsm y devuelve la primera hoja como matriz de celdas. */
export async function matrizDesdeExcel(buffer: Buffer): Promise<unknown[][]> {
  const libro = new ExcelJS.Workbook();
  // exceljs tipa load() con ArrayBuffer; un Buffer de Node funciona igual.
  await libro.xlsx.load(buffer as unknown as ArrayBuffer);

  const hoja = libro.worksheets[0];
  if (!hoja) throw new Error('El archivo no contiene ninguna hoja de calculo.');

  const matriz: unknown[][] = [];
  hoja.eachRow({ includeEmpty: true }, (fila, numeroFila) => {
    const celdas: unknown[] = [];
    // fila.values es 1-based y trae un hueco en la posicion 0.
    const valores = fila.values as unknown[];
    for (let c = 1; c < valores.length; c++) {
      celdas[c - 1] = valorCelda(valores[c]);
    }
    matriz[numeroFila - 1] = celdas;
  });

  for (let i = 0; i < matriz.length; i++) {
    if (!matriz[i]) matriz[i] = [];
  }
  return matriz;
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
  const matriz = esCsv
    ? matrizDesdeCsv(buffer.toString('utf8'))
    : await matrizDesdeExcel(buffer);
  return normalizarMatriz(matriz);
}
