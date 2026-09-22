import 'server-only';
import { query, queryOne } from './db';
import { env } from './env';
import { hashClave, validarClave, verificarClave } from './password.mjs';
import { resolverUsuario } from './usuarios';
import type { SessionUser } from './types';

/**
 * Autenticacion contra la base de datos de la app, para instalaciones en la
 * red interna que no tienen HTTPS ni salida a internet.
 *
 * Esto solo responde "es quien dice ser". El rol y las areas siguen saliendo
 * de la tabla aprobadores, igual que con Microsoft.
 */

interface FilaCredencial {
  correo: string;
  clave_hash: string;
  debe_cambiar_clave: boolean;
  intentos_fallidos: number;
  bloqueado_hasta: string | null;
}

export type ResultadoLogin =
  | { ok: true; usuario: SessionUser }
  | { ok: false; motivo: 'credenciales' | 'bloqueado' | 'no_autorizado'; minutos?: number };

export async function autenticarLocal(
  correoEntrada: string,
  clave: string,
): Promise<ResultadoLogin> {
  const correo = correoEntrada.trim().toLowerCase();

  const fila = await queryOne<FilaCredencial>(
    `SELECT correo, clave_hash, debe_cambiar_clave, intentos_fallidos, bloqueado_hasta
       FROM credenciales WHERE correo = $1`,
    [correo],
  );

  if (!fila) {
    // Se verifica igual contra un hash ficticio para que un correo inexistente
    // tarde lo mismo que uno real y no se pueda deducir quien esta registrado.
    await verificarClave(clave, await hashClave('_'));
    return { ok: false, motivo: 'credenciales' };
  }

  if (fila.bloqueado_hasta && new Date(fila.bloqueado_hasta) > new Date()) {
    const minutos = Math.max(
      1,
      Math.ceil((new Date(fila.bloqueado_hasta).getTime() - Date.now()) / 60_000),
    );
    return { ok: false, motivo: 'bloqueado', minutos };
  }

  if (!(await verificarClave(clave, fila.clave_hash))) {
    const intentos = fila.intentos_fallidos + 1;
    const bloquear = intentos >= env.maxIntentosLogin;

    await query(
      `UPDATE credenciales
          SET intentos_fallidos = $2,
              bloqueado_hasta = CASE WHEN $3 THEN now() + ($4 || ' minutes')::interval ELSE NULL END
        WHERE correo = $1`,
      [correo, bloquear ? 0 : intentos, bloquear, String(env.minutosBloqueoLogin)],
    );

    return bloquear
      ? { ok: false, motivo: 'bloqueado', minutos: env.minutosBloqueoLogin }
      : { ok: false, motivo: 'credenciales' };
  }

  // La contrasena es correcta: ahora se mira si esta autorizada en aprobadores.
  const usuario = await resolverUsuario(correo, correo);
  if (!usuario) return { ok: false, motivo: 'no_autorizado' };

  await query(
    `UPDATE credenciales SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE correo = $1`,
    [correo],
  );

  return { ok: true, usuario: { ...usuario, debeCambiarClave: fila.debe_cambiar_clave } };
}

/** Define o reemplaza la contrasena de una persona. */
export async function establecerClave(
  correo: string,
  clave: string,
  opciones: { debeCambiar: boolean },
): Promise<void> {
  const problema = validarClave(clave);
  if (problema) throw new Error(problema);

  const hash = await hashClave(clave);
  await query(
    `INSERT INTO credenciales (correo, clave_hash, debe_cambiar_clave, actualizado_en)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (correo) DO UPDATE
        SET clave_hash = EXCLUDED.clave_hash,
            debe_cambiar_clave = EXCLUDED.debe_cambiar_clave,
            intentos_fallidos = 0,
            bloqueado_hasta = NULL,
            actualizado_en = now()`,
    [correo.trim().toLowerCase(), hash, opciones.debeCambiar],
  );
}

/** Cambio de contrasena hecho por la propia persona: exige la actual. */
export async function cambiarClavePropia(
  correo: string,
  claveActual: string,
  claveNueva: string,
): Promise<{ ok: boolean; mensaje: string }> {
  const fila = await queryOne<FilaCredencial>(
    `SELECT correo, clave_hash, debe_cambiar_clave, intentos_fallidos, bloqueado_hasta
       FROM credenciales WHERE correo = $1`,
    [correo.trim().toLowerCase()],
  );

  if (!fila) {
    return { ok: false, mensaje: 'Su cuenta no usa contrasena local.' };
  }
  if (!(await verificarClave(claveActual, fila.clave_hash))) {
    return { ok: false, mensaje: 'La contrasena actual no es correcta.' };
  }
  if (claveActual === claveNueva) {
    return { ok: false, mensaje: 'La contrasena nueva debe ser distinta de la actual.' };
  }

  const problema = validarClave(claveNueva);
  if (problema) return { ok: false, mensaje: problema };

  await establecerClave(correo, claveNueva, { debeCambiar: false });
  return { ok: true, mensaje: 'Contrasena actualizada.' };
}

/** Correos que ya tienen contrasena local, para mostrarlo en administracion. */
export async function correosConClave(): Promise<Set<string>> {
  const filas = await query<{ correo: string }>('SELECT correo FROM credenciales');
  return new Set(filas.map((f) => f.correo));
}
