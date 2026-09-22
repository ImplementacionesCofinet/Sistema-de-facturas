import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { cerrarSesion } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  await cerrarSesion();
  return NextResponse.redirect(`${env.appUrl}/login`, { status: 303 });
}
