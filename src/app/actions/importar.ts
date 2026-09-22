'use server';

import { revalidatePath } from 'next/cache';
import { requireContabilidad } from '@/lib/auth';
import { parsearArchivo } from '@/lib/import/parse';
import { importarFilas, type ModoImportacion } from '@/lib/importacion';
import type { ResultadoImportacion } from '@/lib/importacion';

export interface EstadoImportacion {
  ok: boolean;
  mensaje: string;
  resultado?: ResultadoImportacion;
}

export const ESTADO_IMPORTACION_INICIAL: EstadoImportacion = { ok: false, mensaje: '' };

const TAMANO_MAXIMO = 25 * 1024 * 1024; // 25 MB

export async function accionImportar(
  _previo: EstadoImportacion,
  formulario: FormData,
): Promise<EstadoImportacion> {
  try {
    const user = await requireContabilidad();

    const archivo = formulario.get('archivo');
    if (!(archivo instanceof File) || archivo.size === 0) {
      return { ok: false, mensaje: 'Seleccione el archivo descargado de la DIAN.' };
    }
    if (!/\.(xlsx|xlsm|csv)$/i.test(archivo.name)) {
      return {
        ok: false,
        mensaje:
          'Formato no soportado. Use .xlsx o .csv. Si la DIAN entrego un .xls, abralo en Excel y guardelo como .xlsx.',
      };
    }
    if (archivo.size > TAMANO_MAXIMO) {
      return { ok: false, mensaje: 'El archivo supera el limite de 25 MB.' };
    }

    const modo: ModoImportacion = formulario.get('modo') === 'migracion' ? 'migracion' : 'dian';
    const buffer = Buffer.from(await archivo.arrayBuffer());
    const parseo = await parsearArchivo(archivo.name, buffer);

    if (parseo.filas.length === 0) {
      return {
        ok: false,
        mensaje:
          parseo.errores[0]?.motivo ??
          'El archivo no contiene filas procesables.',
      };
    }

    const resultado = await importarFilas(parseo, {
      nombreArchivo: archivo.name,
      modo,
      usuario: user,
    });

    revalidatePath('/facturas');
    revalidatePath('/importar');
    revalidatePath('/contabilizar');

    return {
      ok: true,
      mensaje:
        `Importacion completada: ${resultado.filasNuevas} nuevas, ` +
        `${resultado.filasActualizadas} actualizadas, ` +
        `${resultado.filasSinCambios} sin cambios` +
        (resultado.filasIgnoradas > 0 ? `, ${resultado.filasIgnoradas} sin procesar.` : '.'),
      resultado,
    };
  } catch (error) {
    console.error('[importar]', error);
    return {
      ok: false,
      mensaje:
        error instanceof Error
          ? `No fue posible importar el archivo: ${error.message}`
          : 'No fue posible importar el archivo.',
    };
  }
}
