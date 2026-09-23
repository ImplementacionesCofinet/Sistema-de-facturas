const MONEDA = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

// Algunas facturas llegan con centavos (servicios portuarios, fletes). Si se
// redondearan, 6131,07 se mostraria como 6.131 y el importe dejaria de cuadrar.
const MONEDA_CON_DECIMALES = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const FECHA = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Bogota',
});

const FECHA_HORA = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Bogota',
});

/**
 * Importe con su moneda. Las facturas en divisa distinta al peso se marcan con
 * su codigo, para que no se confunda un importe en dolares con uno en pesos.
 */
export function moneda(
  valor: string | number | null | undefined,
  divisa?: string | null,
): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  const n = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(n)) return '—';

  const formateado = n % 1 === 0 ? MONEDA.format(n) : MONEDA_CON_DECIMALES.format(n);
  if (!divisa || divisa.toUpperCase() === 'COP') return formateado;

  // Se antepone el codigo en vez de cambiar el simbolo: asi se lee igual de
  // rapido en la tabla y no hay duda de que no son pesos.
  const sinSimbolo = formateado.replace(/^\s*\$\s*/, '');
  return `${divisa.toUpperCase()} ${sinSimbolo}`;
}

/** Fecha simple. Las fechas 'YYYY-MM-DD' se muestran tal cual, sin desfase. */
export function fecha(valor: string | null | undefined): string {
  if (!valor) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [a, m, d] = valor.split('-');
    return `${d}/${m}/${a}`;
  }
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? '—' : FECHA.format(d);
}

export function fechaHora(valor: string | Date | null | undefined): string {
  if (!valor) return '—';
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? '—' : FECHA_HORA.format(d);
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** '2026-06' -> 'junio 2026' */
export function periodo(valor: string | null | undefined): string {
  if (!valor || !/^\d{4}-\d{2}$/.test(valor)) return valor ?? '—';
  const [anio, mes] = valor.split('-');
  return `${MESES[Number(mes) - 1]} ${anio}`;
}

const ETIQUETA_TIPO: Record<string, string> = {
  CUENTA_COBRO: 'Cuenta de cobro',
  NOTA_CREDITO: 'Nota crédito',
  NOTA_DEBITO: 'Nota débito',
  OTRO: 'Documento equivalente',
};

/**
 * Como se nombra un documento en pantalla.
 *
 * Las cuentas de cobro no traen numero de factura, y antes se caia al
 * id_unico: en la tabla aparecia "CC_7543484_2026-09-23_2108700.00", que no le
 * dice nada a quien revisa. Se prefiere el numero, luego la abreviatura, y si
 * no hay ninguno, el tipo de documento.
 */
export function nombreDocumento(factura: {
  n_factura: string | null;
  fra_abr: string | null;
  tipo_documento: string;
}): string {
  return (
    factura.n_factura ?? factura.fra_abr ?? ETIQUETA_TIPO[factura.tipo_documento] ?? 'Sin número'
  );
}
