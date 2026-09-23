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

  it('reconoce el encabezado en plural que usa Cofinet', () => {
    // La columna del proveedor se titula "TERCEROS", no "Tercero".
    expect(campoDeEncabezado('TERCEROS')).toBe('tercero');
    expect(campoDeEncabezado('Proveedores')).toBe('tercero');
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
    expect(resultado.errores[0].motivo).toMatch(/repetido/i);
  });

  it('reporta las filas sin identificador construible', () => {
    const resultado = normalizarMatriz([
      encabezados,
      ['', '', '', '', '', 'SIN DATOS', '', ''],
    ]);
    expect(resultado.filas).toHaveLength(0);
    expect(resultado.errores[0].motivo).toMatch(/no se pudo identificar/i);
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

describe('estructura real del Excel de Cofinet', () => {
  // Encabezados exactos del archivo mensual que maneja Contabilidad.
  const encabezados = [
    'Folio', 'Fra Abr', 'Fecha Emision', 'Fecha Recepción', 'Nit', 'TERCEROS',
    'Total', 'Area', 'Nombre aprobador', 'Estado', 'Cbte', 'OBSERVACIONES',
    'FORMA DE PAGO', 'ESTADO DEL PAGO',
  ];

  it('importa una factura con todos sus datos de gestion', () => {
    const r = normalizarMatriz([
      encabezados,
      ['1547781', 'IBE', '2026-08-01', '2026-08-01', '860502609',
       'DHL EXPRESS COLOMBIA LTDA', '5146582', 'COMERCIO EXTERIOR', '',
       'APROBADA', 'CP5785 - OK', 'MUESTRAS PARA UCRANIA', 'TRANSFERENCIA', 'PAGADO'],
    ]);

    expect(r.errores).toHaveLength(0);
    const f = r.filas[0];
    expect(f.tercero).toBe('DHL EXPRESS COLOMBIA LTDA');
    expect(f.nit).toBe('860502609');
    expect(f.total).toBe(5146582);
    expect(f.area).toBe('COMERCIO EXTERIOR');
    expect(f.estado).toBe('APROBADA');
    // La marca de contabilizado venia escrita dentro del comprobante.
    expect(f.cbte).toBe('CP5785');
    expect(f.cbte_ok).toBe(true);
    expect(f.mes_periodo).toBe('2026-08');
  });

  it('acepta "APROBADO" en masculino y el estado con espacios sobrantes', () => {
    const r = normalizarMatriz([
      encabezados,
      ['100', '', '2026-08-05', '', '900111222', 'PROVEEDOR', '1000', 'SISTEMAS',
       '', 'APROBADO  ', 'CP1 - OK', '', '', ''],
    ]);
    expect(r.filas[0].estado).toBe('APROBADA');
  });

  it('identifica una cuenta de cobro que solo trae fecha de recepcion', () => {
    // Varias cuentas de cobro llegan sin fecha de emision.
    const r = normalizarMatriz([
      encabezados,
      ['', '', '', '2026-08-31', '1005091967', 'CUENTA DE COBRO JOSE ALEJANDRO',
       '1400000', 'COMERCIO EXTERIOR', '', 'APROBADA', 'CP6077 - OK', '', '', ''],
    ]);

    expect(r.errores).toHaveLength(0);
    expect(r.filas[0].id_unico).toBe('CC_1005091967_2026-08-31_1400000.00');
    expect(r.filas[0].tipo_documento).toBe('CUENTA_COBRO');
    expect(r.filas[0].mes_periodo).toBe('2026-08');
  });

  it('explica que dato falta cuando no puede identificar el documento', () => {
    const r = normalizarMatriz([
      encabezados,
      ['', '', '', '', '1018512811', 'CUENTA DE COBRO DAVID SERNA', '20481039',
       'COMPRA CAFE (BENEFICIO)', '', 'APROBADA', 'CF-775 - OK', '', '', ''],
    ]);

    expect(r.filas).toHaveLength(0);
    expect(r.errores[0].motivo).toContain('DAVID SERNA');
    expect(r.errores[0].motivo).toContain('fecha');
  });

  it('nombra al tercero cuando descarta una cuenta de cobro repetida', () => {
    const cuenta = ['', '', '2026-08-28', '', '1115189620', 'CUENTA DE COBRO CESAR',
                    '28533532.01', 'COMPRA CAFE (PRODUCCION)', '', 'PENDIENTE',
                    'CF760 - OK', '', '', ''];
    const r = normalizarMatriz([encabezados, cuenta, [...cuenta]]);

    expect(r.filas).toHaveLength(1);
    expect(r.errores[0].motivo).toContain('CUENTA DE COBRO CESAR');
    expect(r.errores[0].motivo).toContain('repetido');
  });

  it('conserva los centavos de los importes en divisa', () => {
    const r = normalizarMatriz([
      encabezados,
      ['3329130', 'OE', '2026-08-01', '', '835000149', 'PUERTO AGUADULCE',
       '6131.07', 'COMERCIO EXTERIOR', '', 'APROBADA', 'CP5639 - OK', '', '', ''],
    ]);
    expect(r.filas[0].total).toBe(6131.07);
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
