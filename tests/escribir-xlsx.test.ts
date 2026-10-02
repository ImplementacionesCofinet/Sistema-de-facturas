import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { escribirXlsx, letraColumna } from '@/lib/import/escribir-xlsx';
import { matrizDesdeXlsx } from '@/lib/import/xlsx';

/**
 * El archivo que se genera para SharePoint tiene que llevar una tabla de Excel
 * con nombre fijo: tanto "Crear lista desde Excel" como la accion de Power
 * Automate que lee filas trabajan sobre una tabla con nombre, no sobre un
 * rango. Si el nombre cambia o la tabla falta, el flujo mensual se rompe.
 */
describe('letraColumna', () => {
  it('traduce la posicion a la letra de Excel', () => {
    expect(letraColumna(0)).toBe('A');
    expect(letraColumna(25)).toBe('Z');
    expect(letraColumna(26)).toBe('AA');
    expect(letraColumna(51)).toBe('AZ');
    expect(letraColumna(52)).toBe('BA');
  });
});

describe('escribirXlsx', () => {
  const encabezados = ['IdUnico', 'Tercero', 'Total', 'CbteOK'];
  const filas = [
    ['901570977_21642', 'INVERSIONES JCMD S.A.S.', 516018.25, 'SI'],
    ['800039996_100351564', 'Kuehne + Nagel S.A.S', 15481752.65, 'NO'],
  ];

  const libro = () => escribirXlsx({ nombreTabla: 'Facturas', encabezados, filas });

  it('lo que se escribe se vuelve a leer igual', () => {
    const m = matrizDesdeXlsx(libro());
    expect(m[0]).toEqual(encabezados);
    expect(m[1]).toEqual(filas[0]);
    expect(m[2]).toEqual(filas[1]);
  });

  it('los importes quedan como numero, no como texto', () => {
    expect(typeof matrizDesdeXlsx(libro())[1][2]).toBe('number');
  });

  it('declara la tabla con el nombre y el rango correctos', () => {
    const zip = unzipSync(new Uint8Array(libro()));
    const tabla = strFromU8(zip['xl/tables/table1.xml']);

    expect(tabla).toContain('name="Facturas"');
    expect(tabla).toContain('displayName="Facturas"');
    // Encabezados mas dos filas, cuatro columnas.
    expect(tabla).toContain('ref="A1:D3"');
    expect(tabla).toContain('<tableColumn id="1" name="IdUnico"/>');
  });

  it('la hoja se enlaza con la tabla', () => {
    const zip = unzipSync(new Uint8Array(libro()));
    expect(strFromU8(zip['xl/worksheets/sheet1.xml'])).toContain('<tableParts count="1">');
    expect(strFromU8(zip['xl/worksheets/_rels/sheet1.xml.rels'])).toContain('tables/table1.xml');
    expect(strFromU8(zip['[Content_Types].xml'])).toContain('/xl/tables/table1.xml');
  });

  it('escapa los caracteres que romperian el XML', () => {
    // "Kuehne + Nagel" paso sin problema, pero hay terceros con & y comillas.
    const m = matrizDesdeXlsx(
      escribirXlsx({
        nombreTabla: 'Facturas',
        encabezados: ['Tercero'],
        filas: [['ARIAS & CIA "LA 14" <S.A.S>']],
      }),
    );
    expect(m[1][0]).toBe('ARIAS & CIA "LA 14" <S.A.S>');
  });

  it('respeta los espacios al inicio y al final', () => {
    const m = matrizDesdeXlsx(
      escribirXlsx({ nombreTabla: 'T', encabezados: ['A'], filas: [['  con espacios  ']] }),
    );
    expect(m[1][0]).toBe('  con espacios  ');
  });

  it('rechaza un nombre de tabla que Power Automate no acepta', () => {
    const invalidos = ['Mis Facturas', 'Rp Doc 2026', '2026Facturas', 'facturas-dian'];
    for (const nombre of invalidos) {
      expect(() => escribirXlsx({ nombreTabla: nombre, encabezados: ['A'], filas: [] })).toThrow(
        /nombre de tabla/,
      );
    }
  });

  it('acepta una tabla sin filas', () => {
    const m = matrizDesdeXlsx(escribirXlsx({ nombreTabla: 'T', encabezados: ['A', 'B'], filas: [] }));
    expect(m[0]).toEqual(['A', 'B']);
  });
});
