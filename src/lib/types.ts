export type EstadoFactura = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';

export type TipoDocumento =
  | 'FACTURA'
  | 'CUENTA_COBRO'
  | 'NOTA_CREDITO'
  | 'NOTA_DEBITO'
  | 'OTRO';

export type Rol = 'APROBADOR' | 'CONTABILIDAD' | 'ADMIN';

export const AREA_SIN_ASIGNAR = 'SIN ASIGNAR';

export interface Factura {
  id: string;
  id_unico: string;
  tipo_documento: TipoDocumento;
  n_factura: string | null;
  fra_abr: string | null;
  cufe: string | null;
  fecha_emision: string | null;
  fecha_recepcion: string | null;
  nit: string | null;
  tercero: string | null;
  total: string | null;
  area: string | null;
  estado: EstadoFactura;
  cbte: string | null;
  cbte_ok: boolean;
  cbte_ok_fecha: string | null;
  cbte_ok_usuario: string | null;
  observaciones: string | null;
  documento_ref: string | null;
  forma_pago: string | null;
  estado_pago: string | null;
  fecha_aprobacion: string | null;
  aprobado_por: string | null;
  mes_periodo: string | null;
  importacion_id: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface Aprobador {
  id: string;
  area: string;
  nombre: string;
  correo: string;
  rol: Rol;
  activo: boolean;
  creado_en?: string;
}

export interface RegistroAuditoria {
  id: string;
  factura_id: string | null;
  id_unico_ref: string | null;
  tercero: string | null;
  area: string | null;
  usuario: string | null;
  fecha_cambio: string;
  campo_modificado: string | null;
  valor_anterior: string | null;
  valor_nuevo: string | null;
}

export interface Importacion {
  id: string;
  nombre_archivo: string | null;
  total_filas: number;
  filas_nuevas: number;
  filas_actualizadas: number;
  filas_sin_cambios: number;
  filas_ignoradas: number;
  errores: string[];
  importado_por: string | null;
  importado_en: string;
}

/** Usuario autenticado tal como viaja en la cookie de sesion. */
export interface SessionUser {
  correo: string;
  nombre: string;
  /** Rol efectivo (el mas alto de sus filas en aprobadores). */
  rol: Rol;
  /** Areas que puede ver y aprobar. Vacio para CONTABILIDAD/ADMIN (ven todo). */
  areas: string[];
}

/** CONTABILIDAD y ADMIN ven todas las areas y pueden importar/contabilizar. */
export function esContabilidad(user: SessionUser): boolean {
  return user.rol === 'CONTABILIDAD' || user.rol === 'ADMIN';
}

export function esAdmin(user: SessionUser): boolean {
  return user.rol === 'ADMIN';
}

/** Un jefe de area solo puede tocar facturas de sus areas. */
export function puedeVerArea(user: SessionUser, area: string | null): boolean {
  if (esContabilidad(user)) return true;
  if (!area) return false;
  return user.areas.some((a) => a.toUpperCase() === area.toUpperCase());
}
