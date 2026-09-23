'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, requireUser } from '@/lib/auth';
import { cambiarClavePropia, establecerClave } from '@/lib/credenciales';
import { generarClaveTemporal } from '@/lib/password.mjs';
import { crearSesion } from '@/lib/session';
import type { EstadoClave } from '@/lib/acciones';

/** La persona cambia su propia contrasena. */
export async function accionCambiarClave(
  _previo: EstadoClave,
  formulario: FormData,
): Promise<EstadoClave> {
  try {
    const user = await requireUser();

    const actual = String(formulario.get('actual') ?? '');
    const nueva = String(formulario.get('nueva') ?? '');
    const confirmacion = String(formulario.get('confirmacion') ?? '');

    if (nueva !== confirmacion) {
      return { ok: false, mensaje: 'La confirmacion no coincide con la contrasena nueva.' };
    }

    const resultado = await cambiarClavePropia(user.correo, actual, nueva);
    if (!resultado.ok) return resultado;

    // Se renueva la sesion para quitar la marca de "debe cambiar la clave".
    await crearSesion({ ...user, debeCambiarClave: false });

    return { ok: true, mensaje: resultado.mensaje };
  } catch (error) {
    console.error('[clave]', error);
    return { ok: false, mensaje: 'No fue posible cambiar la contrasena.' };
  }
}

/** Un administrador genera una clave temporal para otra persona. */
export async function accionGenerarClaveTemporal(
  _previo: EstadoClave,
  formulario: FormData,
): Promise<EstadoClave> {
  try {
    await requireAdmin();

    const correo = String(formulario.get('correo') ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return { ok: false, mensaje: 'El correo no es valido.' };
    }

    const temporal = generarClaveTemporal();
    await establecerClave(correo, temporal, { debeCambiar: true });

    revalidatePath('/aprobadores');
    return {
      ok: true,
      mensaje: `Clave temporal para ${correo}. Entreguesela y pidale que la cambie al entrar.`,
      claveTemporal: temporal,
    };
  } catch (error) {
    console.error('[clave]', error);
    return { ok: false, mensaje: 'No fue posible generar la clave.' };
  }
}
