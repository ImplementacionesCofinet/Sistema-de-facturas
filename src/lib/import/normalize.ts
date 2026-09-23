import type { EstadoFactura, TipoDocumento } from '@/lib/types';

/** Texto limpio, o null si queda vacio. */
export function texto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) return valor.toISOString();
  const s = String(valor).replace(/\s+/g, ' ').trim();
  return s === '' ? null : s;
}

/**
 * Numeros en formato colombiano ("1.234.567,89") y anglosajon ("1,234,567.89").
 * Devuelve null si no hay un numero reconocible.
 */
export function numero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;

  let s = String(valor).trim();
  if (s === '') return null;

  // Parentesis contables = negativo.
  let negativo = false;
  if (/^\(.*\)$/.test(s)) {
    negativo = true;
    s = s.slice(1, -1);
  }

  s = s.replace(/[^0-9.,\-]/g, '');
  if (s.startsWith('-')) negativo = true;
  s = s.replace(/-/g, '');
  if (s === '') return null;

  const ultimaComa = s.lastIndexOf(',');
  const ultimoPunto = s.lastIndexOf('.');

  if (ultimaComa !== -1 && ultimoPunto !== -1) {
    // Ambos separadores: el ultimo en aparecer es el decimal.
    if (ultimaComa > ultimoPunto) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (ultimaComa !== -1) {
    const decimales = s.length - ultimaComa - 1;
    s = decimales > 0 && decimales <= 2 ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if (ultimoPunto !== -1) {
    const decimales = s.length - ultimoPunto - 1;
    const varios = s.split('.').length - 1;
    // "1.234" en Colombia son mil doscientos treinta y cuatro pesos.
    s = decimales > 0 && decimales <= 2 && varios === 1 ? s : s.replace(/\./g, '');
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

const EPOCA_EXCEL = Date.UTC(1899, 11, 30);

/**
 * Fechas de Excel, ISO, dd/mm/aaaa y aaaa-mm-dd.
 * Se asume formato colombiano (dia primero) cuando hay ambiguedad.
 * Devuelve 'YYYY-MM-DD' o null.
 */
export function fecha(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === '') return null;

  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null;
    return valor.toISOString().slice(0, 10);
  }

  if (typeof valor === 'number') {
    // Numero de serie de Excel.
    if (valor < 1 || valor > 100_000) return null;
    const ms = EPOCA_EXCEL + Math.round(valor) * 86_400_000;
    return new Date(ms).toISOString().slice(0, 10);
  }

  const s = String(valor).trim();
  if (s === '') return null;

  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return armarFecha(Number(m[1]), Number(m[2]), Number(m[3]));

  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) {
    let dia = Number(m[1]);
    let mes = Number(m[2]);
    // Si el primer numero no puede ser un dia, el archivo viene en mm/dd/aaaa.
    if (dia > 12 && mes <= 12) {
      // dd/mm/aaaa, tal cual.
    } else if (mes > 12 && dia <= 12) {
      [dia, mes] = [mes, dia];
    }
    return armarFecha(Number(m[3]), mes, dia);
  }

  const parseado = new Date(s);
  return Number.isNaN(parseado.getTime()) ? null : parseado.toISOString().slice(0, 10);
}

function armarFecha(anio: number, mes: number, dia: number): string | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  if (d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return d.toISOString().slice(0, 10);
}

/** Igual que fecha() pero conserva la hora cuando el origen la trae. */
export function fechaHora(valor: unknown): string | null {
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : valor.toISOString();
  }
  if (typeof valor === 'number') {
    if (valor < 1 || valor > 100_000) return null;
    return new Date(EPOCA_EXCEL + valor * 86_400_000).toISOString();
  }
  const s = texto(valor);
  if (!s) return null;
  if (/\d{1,2}:\d{2}/.test(s)) {
    const d = new Date(s.replace(' ', 'T'));
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const soloFecha = fecha(s);
  return soloFecha ? `${soloFecha}T00:00:00.000Z` : null;
}

/**
 * NIT sin puntos, espacios ni digito de verificacion, para que el mismo
 * tercero produzca siempre el mismo id_unico venga como venga en el archivo.
 */
export function nit(valor: unknown): string | null {
  const s = texto(valor);
  if (!s) return null;
  const sinGuion = s.split('-')[0];
  const digitos = sinGuion.replace(/\D/g, '');
  if (digitos !== '') return digitos.replace(/^0+(?=\d)/, '');
  // Documentos extranjeros u otros identificadores alfanumericos.
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '') || null;
}

/** Numero de factura canonico: prefijo + folio, sin espacios ni guiones. */
export function numeroFactura(
  nFactura: unknown,
  prefijo?: unknown,
  folio?: unknown,
): string | null {
  const directo = texto(nFactura);
  if (directo) return directo.toUpperCase().replace(/[\s_-]/g, '');

  const p = texto(prefijo) ?? '';
  const f = texto(folio) ?? '';
  const combinado = `${p}${f}`.toUpperCase().replace(/[\s_-]/g, '');
  return combinado === '' ? null : combinado;
}

export function tipoDocumento(valor: unknown, tieneNumeroFactura: boolean): TipoDocumento {
  const s = (texto(valor) ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

  if (s.includes('cuenta de cobro') || s.includes('cuenta cobro')) return 'CUENTA_COBRO';
  if (s.includes('nota credito') || s.includes('nota de credito')) return 'NOTA_CREDITO';
  if (s.includes('nota debito') || s.includes('nota de debito')) return 'NOTA_DEBITO';
  if (s.includes('factura')) return 'FACTURA';
  return tieneNumeroFactura ? 'FACTURA' : 'CUENTA_COBRO';
}

export function estado(valor: unknown): EstadoFactura {
  const s = (texto(valor) ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();
  if (s.startsWith('APROB')) return 'APROBADA';
  if (s.startsWith('RECHAZ') || s.startsWith('NEGAD')) return 'RECHAZADA';
  return 'PENDIENTE';
}

/**
 * En el Excel de Cofinet la marca de contabilizado va escrita dentro de la
 * misma celda del comprobante: "CP5785 - OK", "CP-6241 OK", "FP-256 - OK".
 * Se separa en sus dos partes para que la app pueda filtrar por contabilizado.
 *
 * Otras anotaciones se respetan tal cual: "CP6212 - PDTE. APROBACION" no es
 * un OK y su texto se conserva completo.
 */
export function comprobante(valor: unknown): { cbte: string | null; ok: boolean } {
  const s = texto(valor);
  if (!s) return { cbte: null, ok: false };

  if (/^OK\.?$/i.test(s)) return { cbte: null, ok: true };

  const m = s.match(/^(.*?)[\s\-\u2013/.]+OK\.?$/i);
  if (m && m[1].trim() !== '') return { cbte: m[1].trim(), ok: true };

  return { cbte: s, ok: false };
}

export function booleano(valor: unknown): boolean {
  if (typeof valor === 'boolean') return valor;
  const s = (texto(valor) ?? '').toUpperCase();
  return ['OK', 'SI', 'SÍ', 'TRUE', 'X', '1', 'VERDADERO', 'YES'].includes(s);
}

/** Area en mayusculas y sin espacios sobrantes, o null. */
export function area(valor: unknown): string | null {
  const s = texto(valor);
  return s ? s.toUpperCase() : null;
}

/** 'YYYY-MM' a partir de una fecha 'YYYY-MM-DD'. */
export function mesPeriodo(fechaIso: string | null): string | null {
  return fechaIso ? fechaIso.slice(0, 7) : null;
}

/**
 * Llave de negocio que identifica el documento entre importaciones sucesivas.
 *   Con numero de factura -> NIT_NumFactura
 *   Cuenta de cobro       -> CC_NIT_Fecha_Total
 */
export function idUnico(params: {
  nit: string | null;
  numeroFactura: string | null;
  fechaEmision: string | null;
  total: number | null;
  cufe?: string | null;
}): string | null {
  const nitNorm = params.nit ?? 'SINNIT';

  if (params.numeroFactura) {
    return `${nitNorm}_${params.numeroFactura}`;
  }

  if (params.cufe) {
    return `CUFE_${params.cufe.toUpperCase()}`;
  }

  if (params.fechaEmision && params.total !== null) {
    return `CC_${nitNorm}_${params.fechaEmision}_${params.total.toFixed(2)}`;
  }

  return null;
}
