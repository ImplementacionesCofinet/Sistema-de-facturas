import { NextResponse } from 'next/server';
import { obtenerSesion } from '@/lib/session';
import { leerAdjuntoLocal } from '@/lib/storage';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

const TIPOS: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.xml': 'application/xml',
};

/** Sirve los soportes guardados con STORAGE_DRIVER=local. Requiere sesion. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ruta: string[] }> },
) {
  if (!(await obtenerSesion())) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }
  if (env.storageDriver !== 'local') {
    return NextResponse.json(
      { error: 'Los adjuntos se sirven desde Azure Blob Storage.' },
      { status: 404 },
    );
  }

  const { ruta } = await params;
  const archivo = await leerAdjuntoLocal(ruta);
  if (!archivo) return NextResponse.json({ error: 'Archivo no encontrado.' }, { status: 404 });

  const extension = archivo.nombre.slice(archivo.nombre.lastIndexOf('.')).toLowerCase();

  return new NextResponse(new Uint8Array(archivo.contenido), {
    headers: {
      'Content-Type': TIPOS[extension] ?? 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(archivo.nombre)}"`,
      'Cache-Control': 'private, max-age=300',
    },
  });
}
