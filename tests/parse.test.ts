import { describe, expect, it } from 'vitest';
import { campoDeEncabezado, mapearColumnas } from '@/lib/import/headers';
import { matrizDesdeCsv, normalizarMatriz } from '@/lib/import/parse';

describe('encabezados', () => {
  it('reconoce los encabezados de la DIAN con tildes y mayusculas', () => {
    expect(campoDeEncabezado('Fecha Emisión')).toBe('fecha_emision');
    expect(campoDeEncabezado('NIT Emisor')).toBe('nit');
    expect(campoDeEncabezado('Nombre Emisor')).toBe('tercero');
  });

  it('no confunde al receptor con el emisor', () => {
    expect(campoDeEncabezado('NIT Receptor')).toBeNull();
    expect(campoDeEncabezado('Nombre Receptor')).toBeNull();
  });

  it('reconoce las columnas del Excel actual de Cofinet', () => {
    expect(campoDeEncabezado('Fra abr')).toBe('fra_abr');
    expect(campoDeEncabezado('Cbte')).toBe('cbte');
    expect(campoDeEncabezado('OK')).toBe('cbte_ok');
    expect(campoDeEncabezado('Área')).toBe('area');
  });

  it('asigna cada campo a una sola columna', () => {
    const mapa = mapearColumnas(['Total', 'Total', 'NIT']);
    expect(mapa.get(0)).toBe('total');
    expect(mapa.get(1)).toBeUndefined();
    expect(mapa.get(2)).toBe('nit');
  });
});

describe('normalizarMatriz', () => {
  const encabezados = [
    'Folio', 'Prefijo', 'Fecha Emisión', 'Fecha Recepción',
    'NIT Emisor', 'Nombre Emisor', 'Total', 'Tipo de Documento',
  ];

  it('normaliza un reporte tipico de la DIAN', () => {
    const resultado = normalizarMatriz([
      ['Reporte de documentos recibidos'],
      [],
      encabezados,
      ['9900', 'SETP', '15/06/2026', '16/06/2026', '900.123.456-7', 'CAFE DEL VALLE SAS', '$ 4.500.000', 'Factura electrónica'],
    ]);

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.filas).toHaveLength(1);

    const fila = resultado.filas[0];
    expect(fila.id_unico).toBe('900123456_SETP9900');
    expect(fila.nit).toBe('900123456');
    expect(fila.tercero).toBe('CAFE DEL VALLE SAS');
    expect(fila.total).toBe(4500000);
    expect(fila.fecha_emision).toBe('2026-06-15');
    expect(fila.mes_periodo).toBe('2026-06');
    expect(fila.tipo_documento).toBe('FACTURA');
    expect(fila.estado).toBe('PENDIENTE');
  });

  it('salta las filas de titulo y encuentra los encabezados', () => {
    const resultado = normalizarMatriz([
      ['DIAN - Dirección de Impuestos'],
      ['Generado el 01/07/2026'],
      [],
      encabezados,
      ['1', 'FE', '01/06/2026', '', '800100200', 'PROVEEDOR UNO', '100000', 'Factura'],
    ]);
    expect(resultado.filas).toHaveLength(1);
  });

  it('descarta duplicados dentro del mismo archivo', () => {
    const resultado = normalizarMatriz([
      encabezados,
      ['1', 'FE', '01/06/2026', '', '800100200', 'PROVEEDOR UNO', '100000', 'Factura'],
      ['1', 'FE', '01/06/2026', '', '800100200', 'PROVEEDOR UNO', '100000', 'Factura'],
    ]);
    expect(resultado.filas).toHaveLength(1);
    expect(resultado.errores[0].motivo).toMatch(/duplicada/i);
  });

  it('reporta las filas sin identificador construible', () => {
    const resultado = normalizarMatriz([
      encabezados,
      ['', '', '', '', '', 'SIN DATOS', '', ''],
    ]);
    expect(resultado.filas).toHaveLength(0);
    expect(resultado.errores[0].motivo).toMatch(/identificador unico/i);
  });

  it('genera el id de cuenta de cobro cuando no hay numero de factura', () => {
    const resultado = normalizarMatriz([
      ['Fecha Emisión', 'NIT', 'Tercero', 'Total', 'Tipo de Documento'],
      ['10/06/2026', '10203040', 'JUAN PEREZ', '1.500.000', 'Cuenta de cobro'],
    ]);
    expect(resultado.filas[0].id_unico).toBe('CC_10203040_2026-06-10_1500000.00');
    expect(resultado.filas[0].tipo_documento).toBe('CUENTA_COBRO');
  });

  it('avisa cuando no reconoce ningun encabezado', () => {
    const resultado = normalizarMatriz([['uno', 'dos'], ['a', 'b']]);
    expect(resultado.filas).toHaveLength(0);
    expect(resultado.errores[0].motivo).toMatch(/encabezados/i);
  });

  it('conserva los campos de gestion del Excel historico', () => {
    const resultado = normalizarMatriz([
      ['N Factura', 'NIT', 'Tercero', 'Total', 'Fecha Emisión', 'Área', 'Estado', 'Cbte', 'OK', 'Observaciones'],
      ['FE100', '900123456', 'CAFE SAS', '500000', '01/05/2026', 'Logistica', 'Aprobada', 'CB-991', 'OK', 'Revisado'],
    ]);
    const fila = resultado.filas[0];
    expect(fila.area).toBe('LOGISTICA');
    expect(fila.estado).toBe('APROBADA');
    expect(fila.cbte).toBe('CB-991');
    expect(fila.cbte_ok).toBe(true);
    expect(fila.observaciones).toBe('Revisado');
  });
});

describe('matrizDesdeCsv', () => {
  it('detecta el punto y coma que usa Excel en espanol', () => {
    const matriz = matrizDesdeCsv('NIT;Tercero;Total\n900123456;CAFE SAS;1.000.000');
    expect(matriz[0]).toEqual(['NIT', 'Tercero', 'Total']);
    expect(matriz[1][2]).toBe('1.000.000');
  });

  it('respeta las comillas y los separadores dentro del texto', () => {
    const matriz = matrizDesdeCsv('a,b\n"uno, dos","dice ""hola"""');
    expect(matriz[1]).toEqual(['uno, dos', 'dice "hola"']);
  });
});
