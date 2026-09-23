import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { indiceColumna, matrizDesdeXlsx } from '@/lib/import/xlsx';

/**
 * El reporte de la DIAN lo genera una herramienta .NET que escribe el XML con
 * prefijo de espacio de nombres (<x:workbook>, <x:sheets>, <x:row>). Las
 * librerias que buscan las etiquetas sin prefijo no encuentran ni las hojas y
 * fallan sin poder leer una sola fila. Aqui se comprueban las dos formas.
 */
function construirXlsx(prefijo: 'x:' | ''): Buffer {
  const p = prefijo;
  const ns = prefijo
    ? ' xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
    : ' xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';

  const workbook =
    `<?xml version="1.0" encoding="utf-8"?><${p}workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"${ns}>` +
    `<${p}sheets><${p}sheet name="Hoja" sheetId="1" r:id="rId1" /></${p}sheets></${p}workbook>`;

  const rels =
    '<?xml version="1.0" encoding="utf-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml" /></Relationships>';

  const compartidas =
    `<?xml version="1.0" encoding="utf-8"?><${p}sst${ns}>` +
    `<${p}si><${p}t>NIT Emisor</${p}t></${p}si>` +
    `<${p}si><${p}t>Nombre Emisor</${p}t></${p}si>` +
    `<${p}si><${p}t>CAFE DEL VALLE SAS</${p}t></${p}si>` +
    `<${p}si><${p}r><${p}t>PARTIDO </${p}t></${p}r><${p}r><${p}t>EN DOS</${p}t></${p}r></${p}si>` +
    `</${p}sst>`;

  const hoja =
    `<?xml version="1.0" encoding="utf-8"?><${p}worksheet${ns}><${p}sheetData>` +
    `<${p}row r="1"><${p}c r="A1" t="s"><${p}v>0</${p}v></${p}c><${p}c r="B1" t="s"><${p}v>1</${p}v></${p}c></${p}row>` +
    // Fila 3: se salta la 2 a proposito, y la celda B antes que la D.
    `<${p}row r="3"><${p}c r="A3"><${p}v>900123456</${p}v></${p}c><${p}c r="B3" t="s"><${p}v>2</${p}v></${p}c>` +
    `<${p}c r="D3" t="s"><${p}v>3</${p}v></${p}c><${p}c r="E3" t="b"><${p}v>1</${p}v></${p}c>` +
    `<${p}c r="F3" t="inlineStr"><${p}is><${p}t>EN LINEA</${p}t></${p}is></${p}c>` +
    `<${p}c r="G3" t="e"><${p}v>#N/A</${p}v></${p}c></${p}row>` +
    `</${p}sheetData></${p}worksheet>`;

  return Buffer.from(
    zipSync({
      'xl/workbook.xml': strToU8(workbook),
      'xl/_rels/workbook.xml.rels': strToU8(rels),
      'xl/sharedStrings.xml': strToU8(compartidas),
      'xl/worksheets/sheet1.xml': strToU8(hoja),
    }),
  );
}

describe('indiceColumna', () => {
  it('traduce la letra de columna a su posicion', () => {
    expect(indiceColumna('A1')).toBe(0);
    expect(indiceColumna('C5')).toBe(2);
    expect(indiceColumna('Z1')).toBe(25);
    expect(indiceColumna('AA1')).toBe(26);
    expect(indiceColumna('AF126')).toBe(31);
  });
});

describe.each([
  ['con prefijo de espacio de nombres (DIAN)', 'x:' as const],
  ['sin prefijo (Excel)', '' as const],
])('lectura de .xlsx %s', (_nombre, prefijo) => {
  const matriz = () => matrizDesdeXlsx(construirXlsx(prefijo));

  it('lee los encabezados desde las cadenas compartidas', () => {
    expect(matriz()[0]).toEqual(['NIT Emisor', 'Nombre Emisor']);
  });

  it('respeta el numero de fila y deja vacias las intermedias', () => {
    const m = matriz();
    expect(m[1]).toEqual([]);
    expect(m[2][0]).toBe(900123456);
  });

  it('ubica cada celda en su columna aunque falten intermedias', () => {
    const fila = matriz()[2];
    expect(fila[1]).toBe('CAFE DEL VALLE SAS');
    expect(fila[2]).toBeUndefined();
    expect(fila[3]).toBe('PARTIDO EN DOS'); // texto con varios tramos
  });

  it('entiende booleanos, texto en linea y celdas con error', () => {
    const fila = matriz()[2];
    expect(fila[4]).toBe(true);
    expect(fila[5]).toBe('EN LINEA');
    expect(fila[6]).toBeNull();
  });
});

describe('archivos que no se pueden leer', () => {
  it('avisa cuando el archivo no es un .xlsx', () => {
    expect(() => matrizDesdeXlsx(Buffer.from('esto no es un zip'))).toThrow(/\.xlsx/);
  });

  it('avisa cuando el zip no es un libro de Excel', () => {
    const zip = Buffer.from(zipSync({ 'hola.txt': strToU8('nada') }));
    expect(() => matrizDesdeXlsx(zip)).toThrow(/libro de Excel/);
  });
});
