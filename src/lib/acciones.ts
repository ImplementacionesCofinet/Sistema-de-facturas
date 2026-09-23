import type { ResultadoImportacion } from './importacion';

/**
 * Tipos y valores iniciales que comparten las server actions con los
 * formularios del navegador.
 *
 * Viven aparte porque un archivo marcado con 'use server' solo puede exportar
 * funciones asincronas: cualquier otra cosa (un objeto, una constante) hace
 * fallar la pagina en tiempo de ejecucion con
 * "A 'use server' file can only export async functions".
 */

export interface EstadoAccion {
  ok: boolean;
  mensaje: string;
}

export const ESTADO_INICIAL: EstadoAccion = { ok: false, mensaje: '' };

export interface EstadoImportacion extends EstadoAccion {
  resultado?: ResultadoImportacion;
}

export const ESTADO_IMPORTACION_INICIAL: EstadoImportacion = { ok: false, mensaje: '' };

export type EstadoAprobador = EstadoAccion;

export const ESTADO_APROBADOR_INICIAL: EstadoAprobador = { ok: false, mensaje: '' };

export interface EstadoClave extends EstadoAccion {
  /** Clave temporal generada, para que el administrador se la entregue. */
  claveTemporal?: string;
}

export const ESTADO_CLAVE_INICIAL: EstadoClave = { ok: false, mensaje: '' };
