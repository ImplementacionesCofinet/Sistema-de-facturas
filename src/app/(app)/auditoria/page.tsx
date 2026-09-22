import Link from 'next/link';
import { requireContabilidad } from '@/lib/auth';
import { query } from '@/lib/db';
import { fechaHora } from '@/lib/formato';
import type { RegistroAuditoria } from '@/lib/types';

export const dynamic = 'force-dynamic';

const POR_PAGINA = 100;

type Busqueda = Promise<Record<string, string | string[] | undefined>>;

function primer(valor: string | string[] | undefined, porDefecto = ''): string {
  return Array.isArray(valor) ? (valor[0] ?? porDefecto) : (valor ?? porDefecto);
}

export default async function PaginaAuditoria({ searchParams }: { searchParams: Busqueda }) {
  await requireContabilidad();
  const params = await searchParams;

  const busqueda = primer(params.q).trim();
  const pagina = Math.max(1, Number(primer(params.pagina, '1')) || 1);

  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (busqueda) {
    valores.push(`%${busqueda.toLowerCase()}%`);
    const p = `$${valores.length}`;
    condiciones.push(
      `(lower(coalesce(usuario,'')) LIKE ${p}
        OR lower(coalesce(tercero,'')) LIKE ${p}
        OR lower(coalesce(area,'')) LIKE ${p}
        OR lower(coalesce(id_unico_ref,'')) LIKE ${p}
        OR lower(coalesce(campo_modificado,'')) LIKE ${p})`,
    );
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [registros, conteo] = await Promise.all([
    query<RegistroAuditoria>(
      `SELECT * FROM auditoria ${where}
        ORDER BY fecha_cambio DESC, id
        LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
      [...valores, POR_PAGINA, (pagina - 1) * POR_PAGINA],
    ),
    query<{ total: string }>(`SELECT count(*)::text AS total FROM auditoria ${where}`, valores),
  ]);

  const total = Number(conteo[0]?.total ?? 0);
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const enlace = (n: number) => {
    const p = new URLSearchParams();
    if (busqueda) p.set('q', busqueda);
    p.set('pagina', String(n));
    return `/auditoria?${p.toString()}`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Auditoria</h1>
        <p className="text-sm text-slate-500">
          Traza completa de cambios: quien, cuando, que campo y con que valores. {total} registro(s).
        </p>
      </div>

      <form method="get" action="/auditoria" className="tarjeta flex flex-wrap gap-2 p-4">
        <input
          name="q"
          defaultValue={busqueda}
          placeholder="Usuario, tercero, area, campo o ID unico"
          className="campo flex-1 min-w-[240px]"
          aria-label="Buscar en la auditoria"
        />
        <button type="submit" className="btn-primary">
          Buscar
        </button>
        <a href="/auditoria" className="btn-secundario">
          Limpiar
        </a>
      </form>

      <div className="tarjeta overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Fecha y hora</th>
              <th className="px-3 py-2 font-semibold">Usuario</th>
              <th className="px-3 py-2 font-semibold">Documento</th>
              <th className="px-3 py-2 font-semibold">Tercero</th>
              <th className="px-3 py-2 font-semibold">Area</th>
              <th className="px-3 py-2 font-semibold">Campo</th>
              <th className="px-3 py-2 font-semibold">Antes</th>
              <th className="px-3 py-2 font-semibold">Despues</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {registros.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                  No hay registros de auditoria.
                </td>
              </tr>
            ) : (
              registros.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600">
                    {fechaHora(r.fecha_cambio)}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{r.usuario ?? '—'}</td>
                  <td className="max-w-[180px] truncate px-3 py-2">
                    {r.factura_id ? (
                      <Link
                        href={`/facturas/${r.factura_id}`}
                        className="text-cofinet-700 hover:underline"
                      >
                        {r.id_unico_ref ?? 'Ver'}
                      </Link>
                    ) : (
                      (r.id_unico_ref ?? '—')
                    )}
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-2 text-slate-600">
                    {r.tercero ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{r.area ?? '—'}</td>
                  <td className="px-3 py-2 font-medium text-slate-700">{r.campo_modificado}</td>
                  <td className="max-w-[180px] truncate px-3 py-2 text-slate-500">
                    {r.valor_anterior ?? '—'}
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-2 text-slate-800">
                    {r.valor_nuevo ?? '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <p>
            Pagina {pagina} de {totalPaginas}
          </p>
          <div className="flex gap-2">
            {pagina > 1 && (
              <Link href={enlace(pagina - 1)} className="btn-secundario">
                Anterior
              </Link>
            )}
            {pagina < totalPaginas && (
              <Link href={enlace(pagina + 1)} className="btn-secundario">
                Siguiente
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
