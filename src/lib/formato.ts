const MONEDA = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
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

export function moneda(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  const n = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(n) ? MONEDA.format(n) : '—';
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
