import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import {
  generarState,
  generarVerificadorPkce,
  retoDesdeVerificador,
  urlAutorizacion,
} from '@/lib/entra';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!env.msConfigured) {
    return NextResponse.redirect(`${env.appUrl}/login?error=no_configurado`);
  }

  const state = generarState();
  const verificador = generarVerificadorPkce();
  const reto = await retoDesdeVerificador(verificador);

  const respuesta = NextResponse.redirect(urlAutorizacion(state, reto));
  const opciones = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 600, // 10 minutos para completar el inicio de sesion.
  };
  respuesta.cookies.set('ms_state', state, opciones);
  respuesta.cookies.set('ms_verifier', verificador, opciones);
  return respuesta;
}
