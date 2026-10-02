import { strToU8, zipSync } from 'fflate';

/**
 * Escritura de archivos .xlsx con una tabla de Excel con nombre fijo.
 *
 * Hace falta porque tanto "Crear lista desde Excel" de SharePoint como la
 * accion "Enumerar filas presentes en una tabla" de Power Automate trabajan
 * sobre una tabla con nombre, no sobre un rango suelto. El archivo que entrega
 * la DIAN trae tabla, pero su nombre cambia cada mes (lleva la fecha y hora de
 * descarga), asi que no sirve para un flujo que espera un nombre estable.
 */

export type Celda = string | number | boolean | null | undefined;

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Excel rechaza el archivo si llegan caracteres de control.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

/** 0 -> "A", 25 -> "Z", 26 -> "AA" */
export function letraColumna(indice: number): string {
  let n = indice + 1;
  let letras = '';
  while (n > 0) {
    const resto = (n - 1) % 26;
    letras = String.fromCharCode(65 + resto) + letras;
    n = Math.floor((n - 1) / 26);
  }
  return letras;
}

function celdaXml(ref: string, valor: Celda): string {
  if (valor === null || valor === undefined || valor === '') return '';

  if (typeof valor === 'number' && Number.isFinite(valor)) {
    return `<c r="${ref}"><v>${valor}</v></c>`;
  }

  const texto = typeof valor === 'boolean' ? (valor ? 'SI' : 'NO') : String(valor);
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapar(texto)}</t></is></c>`;
}

export interface OpcionesLibro {
  /** Nombre de la tabla y de la hoja. Sin espacios: Power Automate lo exige. */
  nombreTabla: string;
  encabezados: string[];
  filas: Celda[][];
}

export function escribirXlsx({ nombreTabla, encabezados, filas }: OpcionesLibro): Buffer {
  if (encabezados.length === 0) throw new Error('La tabla necesita al menos una columna.');
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(nombreTabla)) {
    throw new Error(
      `"${nombreTabla}" no sirve como nombre de tabla: use solo letras, numeros y guion bajo, empezando por letra.`,
    );
  }

  const ultimaColumna = letraColumna(encabezados.length - 1);
  const ultimaFila = filas.length + 1; // +1 por los encabezados
  const rango = `A1:${ultimaColumna}${ultimaFila}`;

  const filaEncabezados =
    `<row r="1">` +
    encabezados.map((h, i) => celdaXml(`${letraColumna(i)}1`, h)).join('') +
    `</row>`;

  const filasXml = filas
    .map((fila, f) => {
      const numero = f + 2;
      const celdas = encabezados
        .map((_, c) => celdaXml(`${letraColumna(c)}${numero}`, fila[c]))
        .join('');
      return `<row r="${numero}">${celdas}</row>`;
    })
    .join('');

  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

  const archivos: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
        `<Override PartName="/xl/tables/table1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>` +
        `</Types>`,
    ),
    '_rels/.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
    ),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="${NS}" xmlns:r="${NS_REL}">` +
        `<sheets><sheet name="${escapar(nombreTabla)}" sheetId="1" r:id="rId1"/></sheets>` +
        `</workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${NS_REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
        `</Relationships>`,
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<worksheet xmlns="${NS}" xmlns:r="${NS_REL}">` +
        `<dimension ref="${rango}"/>` +
        `<sheetData>${filaEncabezados}${filasXml}</sheetData>` +
        `<tableParts count="1"><tablePart r:id="rId1"/></tableParts>` +
        `</worksheet>`,
    ),
    'xl/worksheets/_rels/sheet1.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${NS_REL}/table" Target="../tables/table1.xml"/>` +
        `</Relationships>`,
    ),
    'xl/tables/table1.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<table xmlns="${NS}" id="1" name="${nombreTabla}" displayName="${nombreTabla}" ref="${rango}" totalsRowShown="0">` +
        `<autoFilter ref="${rango}"/>` +
        `<tableColumns count="${encabezados.length}">` +
        encabezados
          .map((h, i) => `<tableColumn id="${i + 1}" name="${escapar(h)}"/>`)
          .join('') +
        `</tableColumns>` +
        `<tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/>` +
        `</table>`,
    ),
  };

  return Buffer.from(zipSync(archivos, { level: 6 }));
}
