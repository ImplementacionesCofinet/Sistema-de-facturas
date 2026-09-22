import 'server-only';
import { redirect } from 'next/navigation';
import { obtenerSesion } from './session';
import type { SessionUser } from './types';

export { resolverUsuario } from './usuarios';

/** Exige sesion activa. Redirige a /login si no la hay. */
export async function requireUser(): Promise<SessionUser> {
  const user = await obtenerSesion();
  if (!user) redirect('/login');
  return user;
}

/** Exige rol CONTABILIDAD o ADMIN. */
export async function requireContabilidad(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.rol !== 'CONTABILIDAD' && user.rol !== 'ADMIN') redirect('/facturas');
  return user;
}

/** Exige rol ADMIN. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.rol !== 'ADMIN') redirect('/facturas');
  return user;
}
