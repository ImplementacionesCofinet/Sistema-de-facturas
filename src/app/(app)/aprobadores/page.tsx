import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';
import { areasDisponibles } from '@/lib/facturas';
import { BotonEstadoAprobador, FormularioAprobador } from '@/components/FormularioAprobador';
import type { Aprobador } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function PaginaAprobadores() {
  await requireAdmin();

  const [aprobadores, areas] = await Promise.all([
    query<Aprobador>(
      `SELECT id, area, nombre, correo, rol, activo FROM aprobadores
        ORDER BY activo DESC, area, nombre`,
    ),
    areasDisponibles(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Aprobadores por area</h1>
        <p className="text-sm text-slate-500">
          El correo debe coincidir con la cuenta de Microsoft 365 con la que la persona inicia
          sesion. Un mismo correo puede tener varias areas a cargo: registre una fila por area.
        </p>
      </div>

      <section className="tarjeta p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Agregar o actualizar
        </h2>
        <FormularioAprobador areas={areas} />
      </section>

      <section className="tarjeta overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Nombre</th>
              <th className="px-3 py-2 font-semibold">Correo</th>
              <th className="px-3 py-2 font-semibold">Area</th>
              <th className="px-3 py-2 font-semibold">Rol</th>
              <th className="px-3 py-2 font-semibold">Estado</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {aprobadores.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                  Todavia no hay aprobadores registrados.
                </td>
              </tr>
            ) : (
              aprobadores.map((a) => (
                <tr key={a.id} className={a.activo ? '' : 'opacity-60'}>
                  <td className="px-3 py-2 font-medium text-slate-800">{a.nombre}</td>
                  <td className="px-3 py-2 text-slate-600">{a.correo}</td>
                  <td className="px-3 py-2 text-slate-600">{a.area}</td>
                  <td className="px-3 py-2">
                    <span className="chip bg-slate-100 text-slate-700">{a.rol}</span>
                  </td>
                  <td className="px-3 py-2">
                    {a.activo ? (
                      <span className="chip bg-emerald-100 text-emerald-800">Activo</span>
                    ) : (
                      <span className="chip bg-slate-200 text-slate-600">Inactivo</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <BotonEstadoAprobador id={a.id} activo={a.activo} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
