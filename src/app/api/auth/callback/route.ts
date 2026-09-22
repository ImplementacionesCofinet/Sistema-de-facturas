import { type NextRequest, NextResponse } from 'next/server';
import { resolverUsuario } from '@/lib/usuarios';
import { intercambiarCodigo, verificarIdToken } from '@/lib/entra';
import { env } from '@/lib/env';
import { crearSesion } from '@/lib/session';

export const dynamic = 'force-dynamic';

function falla(motivo: string): NextResponse {
  const respuesta = NextResponse.redirect(`${env.appUrl}/login?error=${motivo}`);
  respuesta.cookies.delete('ms_state');
  respuesta.cookies.delete('ms_verifier');
  return respuesta;
}

export async function GET(request: NextRequest) {
  const parametros = request.nextUrl.searchParams;

  if (parametros.get('error')) return falla('token');

  const code = parametros.get('code');
  if (!code) return falla('sin_codigo');

  const state = parametros.get('state');
  const stateCookie = request.cookies.get('ms_state')?.value;
  const verificador = request.cookies.get('ms_verifier')?.value;

  if (!state || !stateCookie || state !== stateCookie || !verificador) {
    return falla('estado_invalido');
  }

  const token = await intercambiarCodigo(code, verificador);
  if (!token.id_token) return falla('token');

  let identidad;
  try {
    identidad = await verificarIdToken(token.id_token);
  } catch {
    return falla('token');
  }

  const usuario = await resolverUsuario(identidad.correo, identidad.nombre);
  if (!usuario) return falla('no_autorizado');

  await crearSesion(usuario);

  const respuesta = NextResponse.redirect(`${env.appUrl}/facturas`);
  respuesta.cookies.delete('ms_state');
  respuesta.cookies.delete('ms_verifier');
  return respuesta;
}
