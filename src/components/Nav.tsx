'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { SessionUser } from '@/lib/types';

interface Enlace {
  href: string;
  texto: string;
  soloContabilidad?: boolean;
  soloAdmin?: boolean;
}

const ENLACES: Enlace[] = [
  { href: '/facturas', texto: 'Facturas' },
  { href: '/contabilizar', texto: 'Contabilizar', soloContabilidad: true },
  { href: '/importar', texto: 'Importar DIAN', soloContabilidad: true },
  { href: '/auditoria', texto: 'Auditoria', soloContabilidad: true },
  { href: '/aprobadores', texto: 'Aprobadores', soloAdmin: true },
];

export function Nav({ user }: { user: SessionUser }) {
  const ruta = usePathname();
  const esContabilidad = user.rol === 'CONTABILIDAD' || user.rol === 'ADMIN';
  const esAdmin = user.rol === 'ADMIN';

  const visibles = ENLACES.filter(
    (e) => (!e.soloContabilidad || esContabilidad) && (!e.soloAdmin || esAdmin),
  );

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <Link href="/facturas" className="text-lg font-bold tracking-tight text-cofinet-700">
          COFINET
        </Link>

        <nav className="flex flex-1 flex-wrap items-center gap-1">
          {visibles.map((enlace) => {
            const activo = ruta === enlace.href || ruta.startsWith(`${enlace.href}/`);
            return (
              <Link
                key={enlace.href}
                href={enlace.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  activo
                    ? 'bg-cofinet-50 text-cofinet-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {enlace.texto}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="text-right leading-tight">
            <p className="text-sm font-medium text-slate-700">{user.nombre}</p>
            <p className="text-xs text-slate-500">
              {user.rol === 'APROBADOR'
                ? user.areas.join(' · ') || 'Sin area asignada'
                : user.rol}
            </p>
          </div>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="btn-secundario px-2.5 py-1.5 text-xs">
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
