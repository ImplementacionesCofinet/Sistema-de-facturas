import 'server-only';
import { query, queryOne, withTransaction } from './db';
import { registrarCambios, sonIguales, type Cambio } from './audit';
import {
  AREA_SIN_ASIGNAR,
  esContabilidad,
  puedeVerArea,
  type EstadoFactura,
  type Factura,
  type RegistroAuditoria,
  type SessionUser,
} from './types';

const COLUMNAS = `
  id, id_unico, tipo_documento, n_factura, fra_abr, cufe,
  to_char(fecha_emision, 'YYYY-MM-DD') AS fecha_emision,
  fecha_recepcion, nit, tercero, total, area, estado, cbte, cbte_ok,
  cbte_ok_fecha, cbte_ok_usuario, observaciones, documento_ref,
  forma_pago, estado_pago, fecha_aprobacion, aprobado_por, mes_periodo,
  importacion_id, creado_en, actualizado_en
`;

export interface FiltrosFactura {
  area?: string;
  estado?: EstadoFactura | 'TODOS';
  mesPeriodo?: string;
  contabilizado?: 'SI' | 'NO' | 'TODOS';
  busqueda?: string;
  pagina?: number;
  porPagina?: number;
}

export interface ResultadoListado {
  facturas: Factura[];
  total: number;
  pagina: number;
  porPagina: number;
}

/**
 * Construye el WHERE aplicando siempre el alcance del usuario:
 * un jefe de area solo ve las facturas de sus areas.
 */
function construirFiltros(
  user: SessionUser,
  filtros: FiltrosFactura,
): { where: string; valores: unknown[] } {
  const condiciones: string[] = [];
  const valores: unknown[] = [];

  // Alcance: el jefe de area solo alcanza a ver lo suyo. Contabilidad ve todo.
  if (!esContabilidad(user)) {
    if (user.areas.length === 0) {
      return { where: 'WHERE FALSE', valores: [] };
    }
    valores.push(user.areas);
    condiciones.push(`upper(area) = ANY($${valores.length}::text[])`);
  }

  // Filtro explicito, siempre dentro del alcance anterior.
  if (filtros.area && filtros.area !== 'TODAS') {
    if (filtros.area === AREA_SIN_ASIGNAR) {
      condiciones.push(`(area IS NULL OR btrim(area) = '')`);
    } else {
      valores.push(filtros.area.toUpperCase());
      condiciones.push(`upper(area) = $${valores.length}`);
    }
  }

  if (filtros.estado && filtros.estado !== 'TODOS') {
    valores.push(filtros.estado);
    condiciones.push(`estado = $${valores.length}`);
  }

  if (filtros.mesPeriodo && filtros.mesPeriodo !== 'TODOS') {
    valores.push(filtros.mesPeriodo);
    condiciones.push(`mes_periodo = $${valores.length}`);
  }

  if (filtros.contabilizado === 'SI') condiciones.push('cbte_ok = TRUE');
  if (filtros.contabilizado === 'NO') condiciones.push('cbte_ok = FALSE');

  if (filtros.busqueda && filtros.busqueda.trim() !== '') {
    valores.push(`%${filtros.busqueda.trim().toLowerCase()}%`);
    const p = `$${valores.length}`;
    condiciones.push(
      `(lower(coalesce(tercero,'')) LIKE ${p}
        OR lower(coalesce(nit,'')) LIKE ${p}
        OR lower(coalesce(n_factura,'')) LIKE ${p}
        OR lower(coalesce(cbte,'')) LIKE ${p}
        OR lower(id_unico) LIKE ${p})`,
    );
  }

  return {
    where: condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '',
    valores,
  };
}

export async function listarFacturas(
  user: SessionUser,
  filtros: FiltrosFactura = {},
): Promise<ResultadoListado> {
  const pagina = Math.max(1, filtros.pagina ?? 1);
  const porPagina = Math.min(200, Math.max(10, filtros.porPagina ?? 50));
  const { where, valores } = construirFiltros(user, filtros);

  const conteo = await queryOne<{ total: string }>(
    `SELECT count(*)::text AS total FROM facturas ${where}`,
    valores,
  );

  const facturas = await query<Factura>(
    `SELECT ${COLUMNAS}
       FROM facturas
       ${where}
      ORDER BY fecha_emision DESC NULLS LAST, creado_en DESC
      LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
    [...valores, porPagina, (pagina - 1) * porPagina],
  );

  return { facturas, total: Number(conteo?.total ?? 0), pagina, porPagina };
}

export interface Resumen {
  total: number;
  pendientes: number;
  aprobadas: number;
  rechazadas: number;
  porContabilizar: number;
  montoPendiente: number;
}

export async function obtenerResumen(
  user: SessionUser,
  filtros: FiltrosFactura = {},
): Promise<Resumen> {
  const { where, valores } = construirFiltros(user, { ...filtros, estado: 'TODOS' });
  const fila = await queryOne<Record<string, string>>(
    `SELECT
        count(*)::text AS total,
        count(*) FILTER (WHERE estado = 'PENDIENTE')::text AS pendientes,
        count(*) FILTER (WHERE estado = 'APROBADA')::text  AS aprobadas,
        count(*) FILTER (WHERE estado = 'RECHAZADA')::text AS rechazadas,
        count(*) FILTER (WHERE estado = 'APROBADA' AND cbte_ok = FALSE)::text AS por_contabilizar,
        coalesce(sum(total) FILTER (WHERE estado = 'PENDIENTE'), 0)::text AS monto_pendiente
       FROM facturas ${where}`,
    valores,
  );

  return {
    total: Number(fila?.total ?? 0),
    pendientes: Number(fila?.pendientes ?? 0),
    aprobadas: Number(fila?.aprobadas ?? 0),
    rechazadas: Number(fila?.rechazadas ?? 0),
    porContabilizar: Number(fila?.por_contabilizar ?? 0),
    montoPendiente: Number(fila?.monto_pendiente ?? 0),
  };
}

export async function obtenerFactura(id: string): Promise<Factura | null> {
  return queryOne<Factura>(`SELECT ${COLUMNAS} FROM facturas WHERE id = $1`, [id]);
}

export async function historialFactura(facturaId: string): Promise<RegistroAuditoria[]> {
  return query<RegistroAuditoria>(
    `SELECT * FROM auditoria WHERE factura_id = $1 ORDER BY fecha_cambio DESC, id`,
    [facturaId],
  );
}

export async function periodosDisponibles(): Promise<string[]> {
  const filas = await query<{ mes_periodo: string }>(
    `SELECT DISTINCT mes_periodo FROM facturas
      WHERE mes_periodo IS NOT NULL ORDER BY mes_periodo DESC`,
  );
  return filas.map((f) => f.mes_periodo);
}

export async function areasDisponibles(): Promise<string[]> {
  const filas = await query<{ nombre: string }>(
    `SELECT DISTINCT upper(btrim(nombre)) AS nombre FROM (
        SELECT nombre FROM areas WHERE activo = TRUE
        UNION SELECT area FROM aprobadores WHERE activo = TRUE
        UNION SELECT area FROM facturas WHERE area IS NOT NULL AND btrim(area) <> ''
     ) t
     WHERE nombre IS NOT NULL AND btrim(nombre) <> ''
     ORDER BY 1`,
  );
  return filas.map((f) => f.nombre);
}

/** Campos que un usuario puede modificar desde la interfaz. */
export type CamposEditables = Partial<
  Pick<
    Factura,
    | 'estado'
    | 'observaciones'
    | 'documento_ref'
    | 'area'
    | 'cbte'
    | 'cbte_ok'
    | 'forma_pago'
    | 'estado_pago'
  >
>;

export class ErrorNegocio extends Error {}

/**
 * Unico punto de escritura sobre facturas: aplica el cambio, verifica permisos
 * y deja la traza en auditoria dentro de la misma transaccion.
 */
export async function actualizarFactura(
  id: string,
  cambios: CamposEditables,
  user: SessionUser,
): Promise<Factura> {
  return withTransaction(async (client) => {
    const actual = (
      await client.query<Factura>(`SELECT ${COLUMNAS} FROM facturas WHERE id = $1 FOR UPDATE`, [id])
    ).rows[0];

    if (!actual) throw new ErrorNegocio('La factura no existe.');
    if (!puedeVerArea(user, actual.area)) {
      throw new ErrorNegocio('No tiene permiso sobre facturas de esta area.');
    }

    const soloContabilidad: (keyof CamposEditables)[] = [
      'cbte', 'cbte_ok', 'area', 'forma_pago', 'estado_pago',
    ];
    if (!esContabilidad(user)) {
      for (const campo of soloContabilidad) {
        if (campo in cambios) {
          throw new ErrorNegocio(`Solo Contabilidad puede modificar el campo "${campo}".`);
        }
      }
    }

    const asignaciones: string[] = [];
    const valores: unknown[] = [];
    const traza: Cambio[] = [];

    const set = (columna: string, valor: unknown) => {
      valores.push(valor);
      asignaciones.push(`${columna} = $${valores.length}`);
    };

    for (const [campo, valor] of Object.entries(cambios) as [keyof CamposEditables, unknown][]) {
      if (valor === undefined) continue;
      const anterior = actual[campo as keyof Factura];
      if (sonIguales(anterior, valor)) continue;
      set(campo, valor);
      traza.push({ campo, anterior, nuevo: valor });
    }

    if (traza.length === 0) return actual;

    // Aprobar o rechazar sella quien y cuando.
    if (cambios.estado && cambios.estado !== actual.estado) {
      set('fecha_aprobacion', new Date());
      set('aprobado_por', user.correo);
      traza.push({ campo: 'aprobado_por', anterior: actual.aprobado_por, nuevo: user.correo });
    }

    // Marcar OK sella quien contabilizo y cuando.
    if (cambios.cbte_ok !== undefined && cambios.cbte_ok !== actual.cbte_ok) {
      set('cbte_ok_fecha', cambios.cbte_ok ? new Date() : null);
      set('cbte_ok_usuario', cambios.cbte_ok ? user.correo : null);
      traza.push({
        campo: 'cbte_ok_usuario',
        anterior: actual.cbte_ok_usuario,
        nuevo: cambios.cbte_ok ? user.correo : null,
      });
    }

    valores.push(id);
    const actualizada = (
      await client.query<Factura>(
        `UPDATE facturas SET ${asignaciones.join(', ')} WHERE id = $${valores.length}
         RETURNING ${COLUMNAS}`,
        valores,
      )
    ).rows[0];

    await registrarCambios(client, actualizada, traza, user.correo);
    return actualizada;
  });
}

/** Reglas de negocio de la decision del jefe de area. */
export async function decidirFactura(
  id: string,
  decision: EstadoFactura,
  datos: { observaciones?: string | null; documento_ref?: string | null },
  user: SessionUser,
): Promise<Factura> {
  if (decision === 'RECHAZADA' && !datos.observaciones?.trim()) {
    throw new ErrorNegocio('Para rechazar una factura debe escribir el motivo en observaciones.');
  }

  const actual = await obtenerFactura(id);
  if (!actual) throw new ErrorNegocio('La factura no existe.');
  if (actual.cbte_ok) {
    throw new ErrorNegocio(
      'La factura ya fue contabilizada en OASIS; no se puede cambiar la aprobacion.',
    );
  }

  return actualizarFactura(
    id,
    {
      estado: decision,
      observaciones: datos.observaciones ?? actual.observaciones,
      ...(datos.documento_ref ? { documento_ref: datos.documento_ref } : {}),
    },
    user,
  );
}

/** Registro del comprobante generado en OASIS y marca de contabilizado. */
export async function registrarComprobante(
  id: string,
  datos: { cbte: string | null; cbte_ok: boolean },
  user: SessionUser,
): Promise<Factura> {
  const actual = await obtenerFactura(id);
  if (!actual) throw new ErrorNegocio('La factura no existe.');

  if (datos.cbte_ok) {
    if (!datos.cbte?.trim()) {
      throw new ErrorNegocio('Para marcar OK debe registrar el numero de comprobante (Cbte).');
    }
    if (actual.estado !== 'APROBADA') {
      throw new ErrorNegocio('Solo se pueden contabilizar facturas aprobadas por el jefe de area.');
    }
  }

  return actualizarFactura(id, { cbte: datos.cbte, cbte_ok: datos.cbte_ok }, user);
}
