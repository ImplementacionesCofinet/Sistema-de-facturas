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
    <header className="bg-marca-800 text-crema shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <Link
          href="/facturas"
          className="text-lg font-bold tracking-[0.2em] text-crema hover:text-white"
        >
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
                    ? 'bg-marca-700 text-white'
                    : 'text-marca-200 hover:bg-marca-700/60 hover:text-white'
                }`}
              >
                {enlace.texto}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="text-right leading-tight">
            <p className="text-sm font-medium text-crema">{user.nombre}</p>
            <p className="text-xs text-marca-300">
              {user.rol === 'APROBADOR'
                ? user.areas.join(' · ') || 'Sin area asignada'
                : user.rol}
            </p>
          </div>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="rounded-md border border-marca-400/50 px-3 py-1.5 text-xs font-semibold
                         text-crema transition-colors hover:bg-marca-700"
            >
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
