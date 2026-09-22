import 'server-only';
import { query } from './db';
import { env } from './env';
import type { Aprobador, Rol, SessionUser } from './types';

const PRIORIDAD_ROL: Record<Rol, number> = { APROBADOR: 1, CONTABILIDAD: 2, ADMIN: 3 };

/**
 * Traduce un correo corporativo autenticado por Microsoft al usuario de la app,
 * usando la tabla aprobadores (una fila por area a cargo).
 * Devuelve null si el correo no esta autorizado.
 */
export async function resolverUsuario(
  correo: string,
  nombreMostrado: string,
): Promise<SessionUser | null> {
  const correoNorm = correo.trim().toLowerCase();

  if (env.allowedDomains.length > 0) {
    const dominio = correoNorm.split('@')[1] ?? '';
    if (!env.allowedDomains.includes(dominio)) return null;
  }

  const filas = await query<Aprobador>(
    `SELECT id, area, nombre, correo, rol, activo
       FROM aprobadores
      WHERE lower(correo) = $1 AND activo = TRUE`,
    [correoNorm],
  );

  const esAdminPorEnv = env.adminEmails.includes(correoNorm);

  if (filas.length === 0) {
    // Arranque en frio: los correos de ADMIN_EMAILS entran aunque la tabla
    // aprobadores todavia este vacia, para poder cargarla desde la app.
    if (esAdminPorEnv) {
      return { correo: correoNorm, nombre: nombreMostrado || correoNorm, rol: 'ADMIN', areas: [] };
    }
    return null;
  }

  let rol: Rol = 'APROBADOR';
  for (const fila of filas) {
    if (PRIORIDAD_ROL[fila.rol] > PRIORIDAD_ROL[rol]) rol = fila.rol;
  }
  if (esAdminPorEnv) rol = 'ADMIN';

  const areas = Array.from(
    new Set(filas.map((f) => f.area.trim().toUpperCase()).filter(Boolean)),
  ).sort();

  return {
    correo: correoNorm,
    nombre: filas[0].nombre || nombreMostrado || correoNorm,
    rol,
    areas,
  };
}
