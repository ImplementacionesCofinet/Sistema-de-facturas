import { describe, expect, it } from 'vitest';
import * as N from '@/lib/import/normalize';

describe('numero', () => {
  it('lee el formato colombiano con separador de miles y decimales', () => {
    expect(N.numero('1.234.567,89')).toBe(1234567.89);
  });

  it('lee el formato anglosajon', () => {
    expect(N.numero('1,234,567.89')).toBe(1234567.89);
  });

  it('trata un punto con tres decimales como separador de miles', () => {
    expect(N.numero('1.234')).toBe(1234);
  });

  it('trata una coma con dos decimales como decimal', () => {
    expect(N.numero('1234,50')).toBe(1234.5);
  });

  it('ignora simbolos de moneda', () => {
    expect(N.numero('$ 2.500.000')).toBe(2500000);
  });

  it('interpreta los parentesis contables como negativo', () => {
    expect(N.numero('(1.500,00)')).toBe(-1500);
  });

  it('acepta numeros nativos de Excel', () => {
    expect(N.numero(98765.43)).toBe(98765.43);
  });

  it('devuelve null cuando no hay numero', () => {
    expect(N.numero('')).toBeNull();
    expect(N.numero(null)).toBeNull();
    expect(N.numero('N/A')).toBeNull();
  });
});

describe('fecha', () => {
  it('acepta formato ISO', () => {
    expect(N.fecha('2026-06-15')).toBe('2026-06-15');
  });

  it('asume dia/mes/ano, como en Colombia', () => {
    expect(N.fecha('05/06/2026')).toBe('2026-06-05');
  });

  it('corrige cuando el archivo viene en mes/dia/ano', () => {
    expect(N.fecha('06/25/2026')).toBe('2026-06-25');
  });

  it('convierte el numero de serie de Excel', () => {
    expect(N.fecha(45809)).toBe('2025-06-01');
  });

  it('acepta objetos Date', () => {
    expect(N.fecha(new Date('2026-01-31T10:00:00Z'))).toBe('2026-01-31');
  });

  it('rechaza fechas imposibles', () => {
    expect(N.fecha('31/02/2026')).toBeNull();
  });
});

describe('nit', () => {
  it('quita puntos y digito de verificacion', () => {
    expect(N.nit('900.123.456-7')).toBe('900123456');
  });

  it('normaliza el mismo NIT escrito de varias formas', () => {
    expect(N.nit('900123456')).toBe(N.nit('900.123.456'));
  });

  it('quita ceros a la izquierda', () => {
    expect(N.nit('0012345')).toBe('12345');
  });
});

describe('numeroFactura', () => {
  it('normaliza quitando espacios y guiones', () => {
    expect(N.numeroFactura('FE - 1234')).toBe('FE1234');
  });

  it('combina prefijo y folio cuando vienen separados', () => {
    expect(N.numeroFactura(null, 'SETP', '9900')).toBe('SETP9900');
  });

  it('devuelve null cuando no hay numero', () => {
    expect(N.numeroFactura(null, null, null)).toBeNull();
  });
});

describe('folioClave', () => {
  it('toma el folio de su propia columna', () => {
    expect(N.folioClave('FVE21642', '21642')).toBe('21642');
  });

  it('no mezcla los digitos del prefijo con los del folio', () => {
    // Hay prefijos con digitos ("29FE", "69DA", "1"). Si se quitaran solo las
    // letras del numero completo, la factura 27477 con prefijo 29FE daria
    // 2927477 y no cruzaria con la misma factura del otro archivo.
    expect(N.folioClave('29FE27477', '27477')).toBe('27477');
    expect(N.folioClave('69DA96283', '96283')).toBe('96283');
    expect(N.folioClave('13122686', '3122686')).toBe('3122686');
  });

  it('sin columna de folio, descarta un prefijo alfabetico', () => {
    expect(N.folioClave('FE1234')).toBe('1234');
    expect(N.folioClave('SETP9900')).toBe('9900');
  });

  it('conserva el numero completo si no puede separar el prefijo', () => {
    expect(N.folioClave('ABC')).toBe('ABC');
    expect(N.folioClave('29FE27477')).toBe('29FE27477');
  });

  it('devuelve null cuando no hay numero', () => {
    expect(N.folioClave(null, null)).toBeNull();
  });
});

describe('idUnico', () => {
  it('usa NIT y folio para facturas electronicas', () => {
    expect(
      N.idUnico({ nit: '900123456', folio: '1234', fechaEmision: '2026-06-01', total: 100 }),
    ).toBe('900123456_1234');
  });

  it('da la misma llave venga de la DIAN o del Excel de Cofinet', () => {
    // La DIAN manda prefijo y folio por separado; Cofinet solo el folio.
    const dian = N.idUnico({
      nit: '901570977', folio: N.folioClave('FVE21642', '21642'), fechaEmision: null, total: null,
    });
    const cofinet = N.idUnico({
      nit: '901570977', folio: N.folioClave(null, '21642'), fechaEmision: null, total: null,
    });
    expect(dian).toBe(cofinet);
    expect(dian).toBe('901570977_21642');
  });

  it('usa CC_NIT_Fecha_Total para cuentas de cobro', () => {
    expect(
      N.idUnico({ nit: '10203040', folio: null, fechaEmision: '2026-06-01', total: 1500000 }),
    ).toBe('CC_10203040_2026-06-01_1500000.00');
  });

  it('cae en el CUFE cuando no hay folio ni fecha', () => {
    expect(
      N.idUnico({ nit: '900123456', folio: null, fechaEmision: null, total: null, cufe: 'abc123' }),
    ).toBe('CUFE_ABC123');
  });

  it('devuelve null cuando no hay datos suficientes', () => {
    expect(
      N.idUnico({ nit: null, folio: null, fechaEmision: null, total: null }),
    ).toBeNull();
  });

  it('es estable aunque cambie el formato del NIT', () => {
    const a = N.idUnico({ nit: N.nit('900.123.456-7'), folio: '1234', fechaEmision: null, total: null });
    const b = N.idUnico({ nit: N.nit('900123456'), folio: '1234', fechaEmision: null, total: null });
    expect(a).toBe(b);
  });
});

describe('estado y booleano', () => {
  it('reconoce los estados escritos con o sin tilde', () => {
    expect(N.estado('Aprobada')).toBe('APROBADA');
    expect(N.estado('RECHAZADA')).toBe('RECHAZADA');
    expect(N.estado('')).toBe('PENDIENTE');
    expect(N.estado('cualquier cosa')).toBe('PENDIENTE');
  });

  it('reconoce las marcas de contabilizado del Excel', () => {
    expect(N.booleano('OK')).toBe(true);
    expect(N.booleano('x')).toBe(true);
    expect(N.booleano('')).toBe(false);
  });
});

describe('comprobante', () => {
  // En el Excel de Cofinet la marca de contabilizado va dentro de la celda
  // del comprobante, con varias formas de escribirla.
  it('separa el numero de comprobante de la marca OK', () => {
    expect(N.comprobante('CP5785 - OK')).toEqual({ cbte: 'CP5785', ok: true });
    expect(N.comprobante('CP-6241 OK')).toEqual({ cbte: 'CP-6241', ok: true });
    expect(N.comprobante('FP-256 - OK')).toEqual({ cbte: 'FP-256', ok: true });
    expect(N.comprobante('NB467 - OK')).toEqual({ cbte: 'NB467', ok: true });
  });

  it('conserva los comprobantes compuestos', () => {
    expect(N.comprobante('CP6115 / FP258 - OK')).toEqual({
      cbte: 'CP6115 / FP258',
      ok: true,
    });
  });

  it('no confunde otras anotaciones con un OK', () => {
    expect(N.comprobante('CP6212 - PDTE. APROBACION')).toEqual({
      cbte: 'CP6212 - PDTE. APROBACION',
      ok: false,
    });
  });

  it('deja el comprobante intacto cuando no hay marca', () => {
    expect(N.comprobante('CP6071')).toEqual({ cbte: 'CP6071', ok: false });
  });

  it('acepta una celda que solo dice OK', () => {
    expect(N.comprobante('OK')).toEqual({ cbte: null, ok: true });
  });

  it('trata la celda vacia como sin comprobante', () => {
    expect(N.comprobante('')).toEqual({ cbte: null, ok: false });
    expect(N.comprobante(null)).toEqual({ cbte: null, ok: false });
  });
});

describe('tipoDocumento', () => {
  it('detecta la cuenta de cobro por la columna tipo', () => {
    expect(N.tipoDocumento('Cuenta de cobro', false)).toBe('CUENTA_COBRO');
  });

  it('asume factura cuando hay numero de factura', () => {
    expect(N.tipoDocumento(null, true)).toBe('FACTURA');
  });

  it('asume cuenta de cobro cuando no hay numero', () => {
    expect(N.tipoDocumento(null, false)).toBe('CUENTA_COBRO');
  });
});

describe('mesPeriodo', () => {
  it('extrae el periodo de la fecha de emision', () => {
    expect(N.mesPeriodo('2026-06-15')).toBe('2026-06');
    expect(N.mesPeriodo(null)).toBeNull();
  });
});

describe('nombreDocumento', () => {
  const base = { n_factura: null, fra_abr: null, tipo_documento: 'FACTURA' };

  it('usa el numero de factura cuando lo hay', async () => {
    const { nombreDocumento } = await import('@/lib/formato');
    expect(nombreDocumento({ ...base, n_factura: 'FVE21642' })).toBe('FVE21642');
  });

  it('cae en la abreviatura si no hay numero', async () => {
    const { nombreDocumento } = await import('@/lib/formato');
    expect(nombreDocumento({ ...base, fra_abr: 'CHF' })).toBe('CHF');
  });

  it('nombra las cuentas de cobro por su tipo, no por el id interno', async () => {
    // Antes se mostraba "CC_7543484_2026-09-23_2108700.00" en la tabla.
    const { nombreDocumento } = await import('@/lib/formato');
    expect(nombreDocumento({ ...base, tipo_documento: 'CUENTA_COBRO' })).toBe('Cuenta de cobro');
    expect(nombreDocumento({ ...base, tipo_documento: 'NOTA_CREDITO' })).toBe('Nota crédito');
  });

  it('nunca queda vacio', async () => {
    const { nombreDocumento } = await import('@/lib/formato');
    expect(nombreDocumento({ ...base, tipo_documento: 'FACTURA' })).toBe('Sin número');
  });
});
