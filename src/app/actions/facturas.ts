'use server';

import { revalidatePath } from 'next/cache';
import { requireContabilidad, requireUser } from '@/lib/auth';
import {
  ErrorNegocio,
  actualizarFactura,
  decidirFactura,
  obtenerFactura,
  registrarComprobante,
} from '@/lib/facturas';
import { guardarAdjunto, validarAdjunto } from '@/lib/storage';
import { puedeVerArea, type EstadoFactura } from '@/lib/types';

export interface EstadoAccion {
  ok: boolean;
  mensaje: string;
}

export const ESTADO_INICIAL: EstadoAccion = { ok: false, mensaje: '' };

function fallo(error: unknown): EstadoAccion {
  if (error instanceof ErrorNegocio) return { ok: false, mensaje: error.message };
  console.error('[accion]', error);
  return { ok: false, mensaje: 'Ocurrio un error inesperado. Intente nuevamente.' };
}

function texto(formulario: FormData, campo: string): string | null {
  const valor = formulario.get(campo);
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim();
  return limpio === '' ? null : limpio;
}

/** Sube el soporte adjunto si el formulario trae uno. Devuelve su URL. */
async function subirSoporte(formulario: FormData, facturaId: string): Promise<string | null> {
  const archivo = formulario.get('soporte');
  if (!(archivo instanceof File) || archivo.size === 0) return null;

  const problema = validarAdjunto(archivo.name, archivo.size);
  if (problema) throw new ErrorNegocio(problema);

  const buffer = Buffer.from(await archivo.arrayBuffer());
  const guardado = await guardarAdjunto(facturaId, archivo.name, buffer, archivo.type);
  return guardado.url;
}

/** Aprobar o rechazar: la decision del jefe de area. */
export async function accionDecidir(
  _previo: EstadoAccion,
  formulario: FormData,
): Promise<EstadoAccion> {
  try {
    const user = await requireUser();
    const id = texto(formulario, 'id');
    const decision = texto(formulario, 'decision') as EstadoFactura | null;

    if (!id) throw new ErrorNegocio('Falta el identificador de la factura.');
    if (decision !== 'APROBADA' && decision !== 'RECHAZADA') {
      throw new ErrorNegocio('Debe indicar si aprueba o rechaza.');
    }

    const factura = await obtenerFactura(id);
    if (!factura) throw new ErrorNegocio('La factura no existe.');
    if (!puedeVerArea(user, factura.area)) {
      throw new ErrorNegocio('No tiene permiso sobre facturas de esta area.');
    }

    const urlSoporte = await subirSoporte(formulario, id);

    await decidirFactura(
      id,
      decision,
      { observaciones: texto(formulario, 'observaciones'), documento_ref: urlSoporte },
      user,
    );

    revalidatePath('/facturas');
    revalidatePath(`/facturas/${id}`);
    return {
      ok: true,
      mensaje: decision === 'APROBADA' ? 'Factura aprobada.' : 'Factura rechazada.',
    };
  } catch (error) {
    return fallo(error);
  }
}

/** Adjuntar o reemplazar el documento soporte sin cambiar la decision. */
export async function accionAdjuntar(
  _previo: EstadoAccion,
  formulario: FormData,
): Promise<EstadoAccion> {
  try {
    const user = await requireUser();
    const id = texto(formulario, 'id');
    if (!id) throw new ErrorNegocio('Falta el identificador de la factura.');

    const factura = await obtenerFactura(id);
    if (!factura) throw new ErrorNegocio('La factura no existe.');
    if (!puedeVerArea(user, factura.area)) {
      throw new ErrorNegocio('No tiene permiso sobre facturas de esta area.');
    }

    const urlSoporte = await subirSoporte(formulario, id);
    const observaciones = texto(formulario, 'observaciones');

    if (!urlSoporte && observaciones === factura.observaciones) {
      return { ok: false, mensaje: 'No hay cambios por guardar.' };
    }

    await actualizarFactura(
      id,
      { ...(urlSoporte ? { documento_ref: urlSoporte } : {}), observaciones },
      user,
    );

    revalidatePath(`/facturas/${id}`);
    return { ok: true, mensaje: 'Cambios guardados.' };
  } catch (error) {
    return fallo(error);
  }
}

/** Contabilidad registra el comprobante de OASIS y marca OK. */
export async function accionComprobante(
  _previo: EstadoAccion,
  formulario: FormData,
): Promise<EstadoAccion> {
  try {
    const user = await requireContabilidad();
    const id = texto(formulario, 'id');
    if (!id) throw new ErrorNegocio('Falta el identificador de la factura.');

    await registrarComprobante(
      id,
      { cbte: texto(formulario, 'cbte'), cbte_ok: formulario.get('cbte_ok') === 'on' },
      user,
    );

    revalidatePath('/contabilizar');
    revalidatePath('/facturas');
    revalidatePath(`/facturas/${id}`);
    return { ok: true, mensaje: 'Comprobante registrado.' };
  } catch (error) {
    return fallo(error);
  }
}

/** Contabilidad asigna o corrige el area responsable. */
export async function accionAsignarArea(
  _previo: EstadoAccion,
  formulario: FormData,
): Promise<EstadoAccion> {
  try {
    const user = await requireContabilidad();
    const id = texto(formulario, 'id');
    const area = texto(formulario, 'area');
    if (!id) throw new ErrorNegocio('Falta el identificador de la factura.');
    if (!area) throw new ErrorNegocio('Debe seleccionar un area.');

    await actualizarFactura(id, { area: area.toUpperCase() }, user);

    revalidatePath('/facturas');
    revalidatePath(`/facturas/${id}`);
    return { ok: true, mensaje: `Area asignada a ${area.toUpperCase()}.` };
  } catch (error) {
    return fallo(error);
  }
}

/** Contabilidad actualiza forma y estado de pago. */
export async function accionPago(
  _previo: EstadoAccion,
  formulario: FormData,
): Promise<EstadoAccion> {
  try {
    const user = await requireContabilidad();
    const id = texto(formulario, 'id');
    if (!id) throw new ErrorNegocio('Falta el identificador de la factura.');

    await actualizarFactura(
      id,
      { forma_pago: texto(formulario, 'forma_pago'), estado_pago: texto(formulario, 'estado_pago') },
      user,
    );

    revalidatePath(`/facturas/${id}`);
    return { ok: true, mensaje: 'Informacion de pago actualizada.' };
  } catch (error) {
    return fallo(error);
  }
}
