import { redirect } from 'next/navigation';
import { obtenerSesion } from '@/lib/session';

export default async function Inicio() {
  const user = await obtenerSesion();
  redirect(user ? '/facturas' : '/login');
}
