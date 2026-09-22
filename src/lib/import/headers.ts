/**
 * Mapeo de encabezados de Excel a los campos de la tabla facturas.
 *
 * Soporta dos origenes:
 *  1. El reporte "Documentos recibidos" que se descarga del portal de la DIAN.
 *  2. El Excel que Cofinet viene manejando (para migrar el historico).
 *
 * El emparejamiento es exacto sobre el encabezado normalizado (sin tildes,
 * sin signos de puntuacion, en minusculas), de modo que "NIT Receptor" nunca
 * se confunda con "NIT Emisor".
 */

export type CampoCanonico =
  | 'n_factura'
  | 'prefijo'
  | 'folio'
  | 'fra_abr'
  | 'cufe'
  | 'fecha_emision'
  | 'fecha_recepcion'
  | 'nit'
  | 'tercero'
  | 'total'
  | 'area'
  | 'estado'
  | 'cbte'
  | 'cbte_ok'
  | 'observaciones'
  | 'documento_ref'
  | 'forma_pago'
  | 'estado_pago'
  | 'tipo_documento';

/** minusculas, sin tildes, sin puntuacion, espacios colapsados. */
export function normalizarEncabezado(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ALIAS: Record<CampoCanonico, string[]> = {
  n_factura: [
    'n factura', 'no factura', 'num factura', 'nro factura', 'numero factura',
    'numero de factura', 'factura', 'numero documento', 'numero de documento',
    'no documento', 'documento', 'nro documento',
  ],
  prefijo: ['prefijo'],
  folio: ['folio', 'consecutivo'],
  fra_abr: ['fra abr', 'fra abreviada', 'factura abreviada', 'abreviatura'],
  cufe: ['cufe', 'cude', 'cufe cude', 'cufe o cude'],
  fecha_emision: [
    'fecha emision', 'fecha de emision', 'fecha', 'fecha factura',
    'fecha de la factura', 'fecha expedicion', 'fecha de expedicion',
  ],
  fecha_recepcion: [
    'fecha recepcion', 'fecha de recepcion', 'fecha recibido', 'fecha de recibo',
    'fecha acuse', 'fecha de acuse',
  ],
  nit: [
    'nit', 'nit emisor', 'nit del emisor', 'nit proveedor', 'nit tercero',
    'identificacion emisor', 'documento emisor', 'identificacion',
  ],
  tercero: [
    'tercero', 'nombre emisor', 'nombre del emisor', 'emisor', 'proveedor',
    'nombre proveedor', 'nombre tercero', 'razon social', 'beneficiario',
  ],
  total: ['total', 'valor total', 'total factura', 'gran total', 'monto total', 'valor'],
  area: ['area', 'area responsable', 'departamento', 'centro de costo', 'centro costo'],
  estado: ['estado', 'estado aprobacion', 'estado de aprobacion', 'aprobacion'],
  cbte: ['cbte', 'comprobante', 'n comprobante', 'numero comprobante', 'cbte oasis'],
  cbte_ok: ['ok', 'cbte ok', 'contabilizado', 'ok contabilizado'],
  observaciones: ['observaciones', 'observacion', 'comentarios', 'comentario', 'nota', 'notas'],
  documento_ref: [
    'documento ref', 'documento referencia', 'doc ref', 'soporte',
    'documento soporte', 'adjunto', 'referencia documento', 'link soporte',
  ],
  forma_pago: ['forma de pago', 'forma pago', 'medio de pago', 'medio pago'],
  estado_pago: ['estado pago', 'estado de pago', 'pago', 'estado del pago'],
  tipo_documento: ['tipo de documento', 'tipo documento', 'tipo', 'clase de documento'],
};

const INDICE: Map<string, CampoCanonico> = (() => {
  const mapa = new Map<string, CampoCanonico>();
  for (const [campo, alias] of Object.entries(ALIAS) as [CampoCanonico, string[]][]) {
    for (const a of alias) {
      // El primer campo que reclama un alias se queda con el.
      if (!mapa.has(a)) mapa.set(a, campo);
    }
  }
  return mapa;
})();

export function campoDeEncabezado(encabezado: unknown): CampoCanonico | null {
  return INDICE.get(normalizarEncabezado(encabezado)) ?? null;
}

/**
 * Construye el mapa columna -> campo de una fila de encabezados.
 * Si dos columnas apuntan al mismo campo, gana la primera.
 */
export function mapearColumnas(fila: unknown[]): Map<number, CampoCanonico> {
  const mapa = new Map<number, CampoCanonico>();
  const usados = new Set<CampoCanonico>();
  fila.forEach((celda, indice) => {
    const campo = campoDeEncabezado(celda);
    if (campo && !usados.has(campo)) {
      mapa.set(indice, campo);
      usados.add(campo);
    }
  });
  return mapa;
}

/** Cuantos campos reconoce una fila. Sirve para ubicar la fila de encabezados. */
export function puntajeEncabezado(fila: unknown[]): number {
  return mapearColumnas(fila).size;
}
