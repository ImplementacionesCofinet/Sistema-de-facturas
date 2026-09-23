import 'server-only';
import type { PoolClient } from 'pg';
import { query, withTransaction } from './db';
import { registrarCambios, sonIguales, sonIgualesNumericos, type Cambio } from './audit';
import type { FilaImportada, ResultadoParseo } from './import/parse';
import type { Factura, Importacion, SessionUser } from './types';

/**
 * dian      -> importacion mensual normal. Actualiza unicamente los datos que
 *              provienen de la DIAN y jamas pisa las decisiones tomadas en la
 *              app (estado, observaciones, soporte, comprobante).
 * migracion -> carga inicial del Excel historico de Cofinet. Ademas completa
 *              los campos de gestion que todavia esten vacios en la app.
 */
export type ModoImportacion = 'dian' | 'migracion';

/** Columnas numericas: se comparan por valor, no por texto. */
const CAMPOS_NUMERICOS = new Set(['total']);

/** Datos que manda la DIAN: la app los refresca en cada importacion. */
const CAMPOS_DIAN = [
  'tipo_documento', 'n_factura', 'fra_abr', 'cufe', 'divisa', 'fecha_emision',
  'fecha_recepcion', 'nit', 'tercero', 'total', 'mes_periodo',
] as const;

/** Datos de gestion: solo se completan si estan vacios (modo migracion). */
const CAMPOS_GESTION = [
  'area', 'estado', 'cbte', 'cbte_ok', 'observaciones',
  'documento_ref', 'forma_pago', 'estado_pago',
] as const;

export interface ResultadoImportacion {
  importacionId: string;
  totalFilas: number;
  filasNuevas: number;
  filasActualizadas: number;
  /** Ya estaban registradas y llegaron identicas. */
  filasSinCambios: number;
  /** No se pudieron procesar; el motivo queda en errores. */
  filasIgnoradas: number;
  errores: string[];
}

/**
 * Cuando el archivo no trae area, se reutiliza la ultima area con la que se
 * clasifico a ese mismo NIT. Asi los proveedores recurrentes quedan asignados
 * solos y Contabilidad solo revisa los nuevos.
 */
async function areasPorNit(nits: string[]): Promise<Map<string, string>> {
  if (nits.length === 0) return new Map();
  const filas = await query<{ nit: string; area: string }>(
    `SELECT DISTINCT ON (nit) nit, area
       FROM facturas
      WHERE nit = ANY($1::text[]) AND area IS NOT NULL AND btrim(area) <> ''
      ORDER BY nit, actualizado_en DESC`,
    [nits],
  );
  return new Map(filas.map((f) => [f.nit, f.area]));
}

export async function importarFilas(
  parseo: ResultadoParseo,
  opciones: { nombreArchivo: string; modo: ModoImportacion; usuario: SessionUser },
): Promise<ResultadoImportacion> {
  const { nombreArchivo, modo, usuario } = opciones;
  const errores = parseo.errores.map((e) => `Fila ${e.fila}: ${e.motivo}`);

  const mapaAreas = await areasPorNit(
    Array.from(new Set(parseo.filas.map((f) => f.nit).filter((n): n is string => Boolean(n)))),
  );

  return withTransaction(async (client) => {
    const importacion = (
      await client.query<{ id: string }>(
        `INSERT INTO importaciones (nombre_archivo, importado_por) VALUES ($1, $2) RETURNING id`,
        [nombreArchivo, usuario.correo],
      )
    ).rows[0];

    let nuevas = 0;
    let actualizadas = 0;
    let sinCambios = 0;
    let ignoradas = 0;

    for (const fila of parseo.filas) {
      try {
        const resultado = await aplicarFila(client, fila, {
          modo,
          usuario,
          importacionId: importacion.id,
          areaHeredada: fila.nit ? mapaAreas.get(fila.nit) : undefined,
        });
        if (resultado === 'nueva') nuevas++;
        else if (resultado === 'actualizada') actualizadas++;
        else sinCambios++;
      } catch (error) {
        ignoradas++;
        errores.push(
          `Fila ${fila.fila} (${fila.id_unico}): ${error instanceof Error ? error.message : 'error desconocido'}`,
        );
      }
    }

    await client.query(
      `UPDATE importaciones
          SET total_filas = $2, filas_nuevas = $3, filas_actualizadas = $4,
              filas_sin_cambios = $5, filas_ignoradas = $6, errores = $7::jsonb
        WHERE id = $1`,
      [
        importacion.id,
        parseo.totalFilas,
        nuevas,
        actualizadas,
        sinCambios,
        ignoradas,
        JSON.stringify(errores.slice(0, 500)),
      ],
    );

    return {
      importacionId: importacion.id,
      totalFilas: parseo.totalFilas,
      filasNuevas: nuevas,
      filasActualizadas: actualizadas,
      filasSinCambios: sinCambios,
      filasIgnoradas: ignoradas,
      errores,
    };
  });
}

async function aplicarFila(
  client: PoolClient,
  fila: FilaImportada,
  ctx: {
    modo: ModoImportacion;
    usuario: SessionUser;
    importacionId: string;
    areaHeredada?: string;
  },
): Promise<'nueva' | 'actualizada' | 'sin cambios'> {
  const existente = (
    await client.query<Factura>(
      `SELECT id, id_unico, tipo_documento, n_factura, fra_abr, cufe, divisa,
              to_char(fecha_emision, 'YYYY-MM-DD') AS fecha_emision,
              fecha_recepcion, nit, tercero, total, area, estado, cbte, cbte_ok,
              observaciones, documento_ref, forma_pago, estado_pago, mes_periodo
         FROM facturas WHERE id_unico = $1 FOR UPDATE`,
      [fila.id_unico],
    )
  ).rows[0];

  if (!existente) {
    const area = fila.area ?? ctx.areaHeredada ?? null;
    const insertada = (
      await client.query<Factura>(
        `INSERT INTO facturas
           (id_unico, tipo_documento, n_factura, fra_abr, cufe, divisa, fecha_emision,
            fecha_recepcion, nit, tercero, total, area, estado, cbte, cbte_ok,
            observaciones, documento_ref, forma_pago, estado_pago, mes_periodo,
            importacion_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         RETURNING id, id_unico, tercero, area`,
        [
          fila.id_unico, fila.tipo_documento, fila.n_factura, fila.fra_abr, fila.cufe,
          fila.divisa, fila.fecha_emision, fila.fecha_recepcion, fila.nit, fila.tercero, fila.total,
          area, fila.estado, fila.cbte, fila.cbte_ok, fila.observaciones,
          fila.documento_ref, fila.forma_pago, fila.estado_pago, fila.mes_periodo,
          ctx.importacionId,
        ],
      )
    ).rows[0];

    await registrarCambios(
      client,
      insertada,
      [{ campo: 'IMPORTACION', anterior: null, nuevo: `Creada desde archivo (${ctx.modo})` }],
      ctx.usuario.correo,
    );
    return 'nueva';
  }

  const asignaciones: string[] = [];
  const valores: unknown[] = [];
  const traza: Cambio[] = [];

  const set = (columna: string, anterior: unknown, nuevo: unknown) => {
    valores.push(nuevo);
    asignaciones.push(`${columna} = $${valores.length}`);
    traza.push({ campo: columna, anterior, nuevo });
  };

  // Datos de la DIAN: se refrescan si el archivo trae un valor distinto.
  for (const campo of CAMPOS_DIAN) {
    const nuevo = fila[campo as keyof FilaImportada];
    if (nuevo === null || nuevo === undefined || nuevo === '') continue;
    const anterior = existente[campo as keyof Factura];
    const iguales = CAMPOS_NUMERICOS.has(campo)
      ? sonIgualesNumericos(anterior, nuevo)
      : sonIguales(anterior, nuevo);
    if (iguales) continue;
    set(campo, anterior, nuevo);
  }

  // Area: se completa si esta vacia, nunca se reasigna sola.
  if (!existente.area) {
    const area = fila.area ?? ctx.areaHeredada ?? null;
    if (area) set('area', existente.area, area);
  }

  // Campos de gestion: solo en la carga inicial y solo si estan sin usar.
  if (ctx.modo === 'migracion') {
    for (const campo of CAMPOS_GESTION) {
      if (campo === 'area') continue;
      const nuevo = fila[campo as keyof FilaImportada];
      if (nuevo === null || nuevo === undefined || nuevo === '' || nuevo === false) continue;

      const anterior = existente[campo as keyof Factura];
      const vacio =
        anterior === null ||
        anterior === undefined ||
        anterior === '' ||
        anterior === false ||
        (campo === 'estado' && anterior === 'PENDIENTE');
      if (!vacio || sonIguales(anterior, nuevo)) continue;
      set(campo, anterior, nuevo);
    }
  }

  if (asignaciones.length === 0) return 'sin cambios';

  valores.push(existente.id);
  await client.query(
    `UPDATE facturas SET ${asignaciones.join(', ')} WHERE id = $${valores.length}`,
    valores,
  );
  await registrarCambios(client, existente, traza, ctx.usuario.correo);
  return 'actualizada';
}

export async function listarImportaciones(limite = 50): Promise<Importacion[]> {
  return query<Importacion>(
    `SELECT id, nombre_archivo, total_filas, filas_nuevas, filas_actualizadas,
            filas_sin_cambios, filas_ignoradas, errores, importado_por, importado_en
       FROM importaciones
      ORDER BY importado_en DESC
      LIMIT $1`,
    [limite],
  );
}
