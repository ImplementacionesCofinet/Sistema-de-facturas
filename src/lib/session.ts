import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { env } from './env';
import type { Rol, SessionUser } from './types';

const COOKIE_NAME = 'cofinet_sesion';
const MAX_AGE_SEGUNDOS = 60 * 60 * 10; // 10 horas: una jornada laboral.

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.sessionSecret);
}

export async function crearSesion(user: SessionUser): Promise<void> {
  const token = await new SignJWT({
    correo: user.correo,
    nombre: user.nombre,
    rol: user.rol,
    areas: user.areas,
    debeCambiarClave: user.debeCambiarClave ?? false,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEGUNDOS}s`)
    .sign(secretKey());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SEGUNDOS,
  });
}

export async function cerrarSesion(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Devuelve el usuario de la cookie, o null si no hay sesion valida. */
export async function obtenerSesion(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      correo: String(payload.correo),
      nombre: String(payload.nombre),
      rol: payload.rol as Rol,
      areas: Array.isArray(payload.areas) ? (payload.areas as string[]) : [],
      debeCambiarClave: payload.debeCambiarClave === true,
    };
  } catch {
    return null;
  }
}
