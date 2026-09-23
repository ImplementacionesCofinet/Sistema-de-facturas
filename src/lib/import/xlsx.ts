import { strFromU8, unzipSync } from 'fflate';
import { XMLParser } from 'fast-xml-parser';

/**
 * Lector de archivos .xlsx.
 *
 * Se escribio a mano porque los dos origenes que maneja Cofinet no los cubre
 * una sola libreria: el reporte de la DIAN viene generado por una herramienta
 * .NET que escribe el XML con prefijo de espacio de nombres (<x:workbook>,
 * <x:sheets>), y las librerias que buscan las etiquetas sin prefijo no
 * encuentran ni las hojas. Aqui el prefijo se ignora, de modo que sirven tanto
 * el archivo de la DIAN como el que exporta Excel.
 *
 * Devuelve la primera hoja como matriz de celdas en crudo (texto, numero o
 * booleano). Las fechas llegan como el numero de serie de Excel, que es lo que
 * normalize.fecha() ya sabe interpretar.
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  // La clave: descarta "x:" y cualquier otro prefijo de espacio de nombres.
  removeNSPrefix: true,
  // Sin conversion automatica: un folio "007" debe seguir siendo "007".
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  isArray: (nombre) => ['sheet', 'row', 'c', 'si', 'r', 'Relationship'].includes(nombre),
});

/** "C" -> 2, "AB" -> 27 */
export function indiceColumna(referencia: string): number {
  const letras = referencia.replace(/[^A-Za-z]/g, '').toUpperCase();
  let n = 0;
  for (const letra of letras) {
    n = n * 26 + (letra.charCodeAt(0) - 64);
  }
  return n - 1;
}

function textoDe(nodo: unknown): string {
  if (nodo === null || nodo === undefined) return '';
  if (typeof nodo === 'object') {
    const v = nodo as Record<string, unknown>;
    return v['#text'] !== undefined ? String(v['#text']) : '';
  }
  return String(nodo);
}

/** Cadenas compartidas, incluidas las que vienen partidas en varios tramos. */
function leerCadenas(xml: string | undefined): string[] {
  if (!xml) return [];
  const doc = parser.parse(xml) as {
    sst?: { si?: Array<{ t?: unknown; r?: Array<{ t?: unknown }> }> };
  };

  return (doc.sst?.si ?? []).map((si) => {
    if (si.t !== undefined) return textoDe(si.t);
    if (Array.isArray(si.r)) return si.r.map((tramo) => textoDe(tramo.t)).join('');
    return '';
  });
}

/** Ruta de la primera hoja, resolviendo la relacion declarada en el libro. */
function rutaPrimeraHoja(archivos: Record<string, Uint8Array>): string {
  const libro = parser.parse(strFromU8(archivos['xl/workbook.xml'])) as {
    workbook?: { sheets?: { sheet?: Array<Record<string, string>> } };
  };

  const hojas = libro.workbook?.sheets?.sheet;
  if (!hojas || hojas.length === 0) {
    throw new Error('El archivo no declara ninguna hoja de calculo.');
  }

  const idRelacion = hojas[0]['@id'];
  const relaciones = archivos['xl/_rels/workbook.xml.rels'];

  if (idRelacion && relaciones) {
    const doc = parser.parse(strFromU8(relaciones)) as {
      Relationships?: { Relationship?: Array<Record<string, string>> };
    };
    const relacion = (doc.Relationships?.Relationship ?? []).find(
      (r) => r['@Id'] === idRelacion,
    );
    if (relacion?.['@Target']) {
      const destino = relacion['@Target'].replace(/^\/?(xl\/)?/, '');
      const ruta = `xl/${destino}`;
      if (archivos[ruta]) return ruta;
    }
  }

  // Sin relacion utilizable, se toma la primera hoja que exista.
  const candidata = Object.keys(archivos)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort()[0];

  if (!candidata) throw new Error('El archivo no contiene ninguna hoja de calculo.');
  return candidata;
}

interface Celda {
  '@r'?: string;
  '@t'?: string;
  v?: unknown;
  is?: { t?: unknown };
}

function valorDeCelda(celda: Celda, cadenas: string[]): unknown {
  const tipo = celda['@t'];

  if (tipo === 'inlineStr') return textoDe(celda.is?.t) || null;
  if (tipo === 'e') return null; // #N/A, #REF!, etc.

  const crudo = celda.v === undefined ? null : textoDe(celda.v) || String(celda.v ?? '');
  if (crudo === null || crudo === '') return null;

  if (tipo === 's') {
    const indice = Number(crudo);
    return Number.isInteger(indice) ? (cadenas[indice] ?? null) : null;
  }
  if (tipo === 'b') return crudo === '1';
  if (tipo === 'str') return crudo;

  // Sin tipo declarado es un numero. Las fechas son numeros de serie de Excel.
  const n = Number(crudo);
  return Number.isFinite(n) ? n : crudo;
}

export function matrizDesdeXlsx(buffer: Buffer): unknown[][] {
  let archivos: Record<string, Uint8Array>;
  try {
    archivos = unzipSync(new Uint8Array(buffer));
  } catch {
    throw new Error(
      'No se pudo abrir el archivo. Debe ser un .xlsx; si es un .xls antiguo, ' +
        'abralo en Excel y guardelo como .xlsx.',
    );
  }

  if (!archivos['xl/workbook.xml']) {
    throw new Error(
      'El archivo no tiene la estructura de un libro de Excel (.xlsx).',
    );
  }

  const cadenas = leerCadenas(
    archivos['xl/sharedStrings.xml'] ? strFromU8(archivos['xl/sharedStrings.xml']) : undefined,
  );

  const hoja = parser.parse(strFromU8(archivos[rutaPrimeraHoja(archivos)])) as {
    worksheet?: { sheetData?: { row?: Array<{ '@r'?: string; c?: Celda[] }> } };
  };

  const filas = hoja.worksheet?.sheetData?.row ?? [];
  const matriz: unknown[][] = [];
  let siguienteFila = 0;

  for (const fila of filas) {
    // Se respeta el numero de fila del archivo para no desplazar los datos
    // cuando hay filas vacias intercaladas.
    const indiceFila = fila['@r'] ? Number(fila['@r']) - 1 : siguienteFila;
    siguienteFila = indiceFila + 1;

    const celdas: unknown[] = [];
    let siguienteColumna = 0;

    for (const celda of fila.c ?? []) {
      const indice = celda['@r'] ? indiceColumna(celda['@r']) : siguienteColumna;
      siguienteColumna = indice + 1;
      celdas[indice] = valorDeCelda(celda, cadenas);
    }

    matriz[indiceFila] = celdas;
  }

  for (let i = 0; i < matriz.length; i++) {
    if (!matriz[i]) matriz[i] = [];
  }

  return matriz;
}
