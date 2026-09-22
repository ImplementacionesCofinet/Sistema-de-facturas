import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Comprobacion de estado. La usa el HEALTHCHECK de Docker y sirve para que
 * Sistemas verifique desde la red si el servicio esta arriba.
 * No expone informacion: solo dice si la app responde y alcanza la base.
 */
export async function GET() {
  try {
    await queryOne('SELECT 1 AS ok');
    return NextResponse.json({ estado: 'ok', baseDeDatos: 'ok' });
  } catch {
    return NextResponse.json({ estado: 'degradado', baseDeDatos: 'sin conexion' }, { status: 503 });
  }
}
