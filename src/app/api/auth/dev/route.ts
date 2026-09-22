import { type NextRequest, NextResponse } from 'next/server';
import { resolverUsuario } from '@/lib/usuarios';
import { env } from '@/lib/env';
import { crearSesion } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Inicio de sesion local sin Microsoft, unicamente para desarrollo.
 * Requiere DEV_AUTH=true y NODE_ENV distinto de production.
 */
export async function POST(request: NextRequest) {
  if (!env.devAuthEnabled) {
    return NextResponse.json({ error: 'No disponible.' }, { status: 404 });
  }

  const formulario = await request.formData();
  const correo = String(formulario.get('correo') ?? '').trim();
  if (!correo) return NextResponse.redirect(`${env.appUrl}/login?error=sin_codigo`, 303);

  const usuario = await resolverUsuario(correo, correo);
  if (!usuario) return NextResponse.redirect(`${env.appUrl}/login?error=no_autorizado`, 303);

  await crearSesion(usuario);
  return NextResponse.redirect(`${env.appUrl}/facturas`, 303);
}
