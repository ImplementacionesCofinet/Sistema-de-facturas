'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';
import type { Rol } from '@/lib/types';
import type { EstadoAprobador } from '@/lib/acciones';

const ROLES: Rol[] = ['APROBADOR', 'CONTABILIDAD', 'ADMIN'];

export async function accionGuardarAprobador(
  _previo: EstadoAprobador,
  formulario: FormData,
): Promise<EstadoAprobador> {
  try {
    await requireAdmin();

    const area = String(formulario.get('area') ?? '').trim().toUpperCase();
    const nombre = String(formulario.get('nombre') ?? '').trim();
    const correo = String(formulario.get('correo') ?? '').trim().toLowerCase();
    const rol = String(formulario.get('rol') ?? 'APROBADOR') as Rol;

    if (!area) return { ok: false, mensaje: 'El area es obligatoria.' };
    if (!nombre) return { ok: false, mensaje: 'El nombre es obligatorio.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return { ok: false, mensaje: 'El correo no es valido.' };
    }
    if (!ROLES.includes(rol)) return { ok: false, mensaje: 'Rol invalido.' };

    await query(
      `INSERT INTO aprobadores (area, nombre, correo, rol, activo)
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT (lower(correo), upper(area))
       DO UPDATE SET nombre = EXCLUDED.nombre, rol = EXCLUDED.rol, activo = TRUE`,
      [area, nombre, correo, rol],
    );

    await query(`INSERT INTO areas (nombre) VALUES ($1) ON CONFLICT (upper(nombre)) DO NOTHING`, [
      area,
    ]);

    revalidatePath('/aprobadores');
    return { ok: true, mensaje: `${nombre} quedo registrado en ${area}.` };
  } catch (error) {
    console.error('[aprobadores]', error);
    return { ok: false, mensaje: 'No fue posible guardar el aprobador.' };
  }
}

export async function accionCambiarEstadoAprobador(
  _previo: EstadoAprobador,
  formulario: FormData,
): Promise<EstadoAprobador> {
  try {
    await requireAdmin();
    const id = String(formulario.get('id') ?? '');
    const activo = formulario.get('activo') === 'true';
    if (!id) return { ok: false, mensaje: 'Falta el identificador.' };

    await query('UPDATE aprobadores SET activo = $2 WHERE id = $1', [id, activo]);
    revalidatePath('/aprobadores');
    return { ok: true, mensaje: activo ? 'Aprobador activado.' : 'Aprobador desactivado.' };
  } catch (error) {
    console.error('[aprobadores]', error);
    return { ok: false, mensaje: 'No fue posible actualizar el aprobador.' };
  }
}
