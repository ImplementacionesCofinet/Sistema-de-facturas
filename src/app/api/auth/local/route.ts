import { type NextRequest, NextResponse } from 'next/server';
import { autenticarLocal } from '@/lib/credenciales';
import { env } from '@/lib/env';
import { crearSesion } from '@/lib/session';

export const dynamic = 'force-dynamic';

function aLogin(error: string, extra?: string): NextResponse {
  const url = new URL('/login', env.appUrl);
  url.searchParams.set('error', error);
  if (extra) url.searchParams.set('min', extra);
  return NextResponse.redirect(url, 303);
}

/** Inicio de sesion con usuario y contrasena de la propia base de datos. */
export async function POST(request: NextRequest) {
  if (!env.localAuthEnabled) {
    return NextResponse.json({ error: 'No disponible.' }, { status: 404 });
  }

  const formulario = await request.formData();
  const correo = String(formulario.get('correo') ?? '');
  const clave = String(formulario.get('clave') ?? '');

  if (!correo || !clave) return aLogin('credenciales');

  const resultado = await autenticarLocal(correo, clave);

  if (!resultado.ok) {
    return aLogin(resultado.motivo, resultado.minutos ? String(resultado.minutos) : undefined);
  }

  await crearSesion(resultado.usuario);

  const destino = resultado.usuario.debeCambiarClave ? '/cambiar-clave' : '/facturas';
  return NextResponse.redirect(new URL(destino, env.appUrl), 303);
}
