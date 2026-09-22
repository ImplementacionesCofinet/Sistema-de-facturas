import 'server-only';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from './env';

/**
 * Almacenamiento de documentos soporte.
 *  - local: carpeta en disco, servida por /api/adjuntos/[...ruta]. Util en
 *    desarrollo y en despliegues con volumen persistente.
 *  - azure: Azure Blob Storage, recomendado en produccion.
 */

const EXTENSIONES_PERMITIDAS = [
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.xlsx', '.xls', '.csv', '.doc', '.docx', '.txt', '.zip', '.xml',
];

export const TAMANO_MAXIMO_BYTES = 20 * 1024 * 1024; // 20 MB

export function validarAdjunto(nombre: string, tamano: number): string | null {
  const ext = path.extname(nombre).toLowerCase();
  if (!EXTENSIONES_PERMITIDAS.includes(ext)) {
    return `Tipo de archivo no permitido (${ext || 'sin extension'}). Permitidos: ${EXTENSIONES_PERMITIDAS.join(', ')}`;
  }
  if (tamano > TAMANO_MAXIMO_BYTES) {
    return `El archivo supera el limite de ${TAMANO_MAXIMO_BYTES / (1024 * 1024)} MB.`;
  }
  return null;
}

/** Nombre seguro y unico: sin rutas, sin caracteres raros, con prefijo aleatorio. */
function nombreSeguro(original: string): string {
  const base = path
    .basename(original)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .slice(-80);
  return `${randomUUID()}-${base}`;
}

export interface AdjuntoGuardado {
  /** Valor que se guarda en facturas.documento_ref. */
  url: string;
  nombreOriginal: string;
}

export async function guardarAdjunto(
  facturaId: string,
  nombreOriginal: string,
  contenido: Buffer,
  contentType: string,
): Promise<AdjuntoGuardado> {
  const nombre = nombreSeguro(nombreOriginal);
  const ruta = `${facturaId}/${nombre}`;

  if (env.storageDriver === 'azure') {
    const conexion = env.azureStorageConnectionString;
    if (!conexion) {
      throw new Error(
        'STORAGE_DRIVER=azure pero falta AZURE_STORAGE_CONNECTION_STRING.',
      );
    }
    const { BlobServiceClient } = await import('@azure/storage-blob');
    const servicio = BlobServiceClient.fromConnectionString(conexion);
    const contenedor = servicio.getContainerClient(env.azureStorageContainer);
    await contenedor.createIfNotExists();
    const blob = contenedor.getBlockBlobClient(ruta);
    await blob.uploadData(contenido, {
      blobHTTPHeaders: { blobContentType: contentType || 'application/octet-stream' },
    });
    return { url: blob.url, nombreOriginal };
  }

  const destino = path.join(path.resolve(env.storageLocalDir), facturaId);
  await fs.mkdir(destino, { recursive: true });
  await fs.writeFile(path.join(destino, nombre), contenido);
  return { url: `/api/adjuntos/${ruta}`, nombreOriginal };
}

/** Lee un adjunto local. Rechaza cualquier intento de salir de la carpeta base. */
export async function leerAdjuntoLocal(
  segmentos: string[],
): Promise<{ contenido: Buffer; nombre: string } | null> {
  const base = path.resolve(env.storageLocalDir);
  const destino = path.resolve(base, ...segmentos);

  if (destino !== base && !destino.startsWith(base + path.sep)) return null;

  try {
    const contenido = await fs.readFile(destino);
    return { contenido, nombre: path.basename(destino) };
  } catch {
    return null;
  }
}
