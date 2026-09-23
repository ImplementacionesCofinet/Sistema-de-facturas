import Link from 'next/link';
import { ContabilizadoChip, EstadoChip } from './EstadoChip';
import { fecha, moneda } from '@/lib/formato';
import type { Factura } from '@/lib/types';

export function TablaFacturas({
  facturas,
  mostrarArea = true,
}: {
  facturas: Factura[];
  mostrarArea?: boolean;
}) {
  if (facturas.length === 0) {
    return (
      <div className="tarjeta px-6 py-12 text-center text-sm text-slate-500">
        No hay facturas que coincidan con los filtros seleccionados.
      </div>
    );
  }

  return (
    <div className="tarjeta overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left">
          <tr className="text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2 font-semibold">N° Factura</th>
            <th className="px-3 py-2 font-semibold">Tercero</th>
            <th className="px-3 py-2 font-semibold">NIT</th>
            <th className="px-3 py-2 font-semibold">Emision</th>
            <th className="px-3 py-2 text-right font-semibold">Total</th>
            {mostrarArea && <th className="px-3 py-2 font-semibold">Area</th>}
            <th className="px-3 py-2 font-semibold">Estado</th>
            <th className="px-3 py-2 font-semibold">Cbte</th>
            <th className="px-3 py-2 font-semibold">OK</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {facturas.map((f) => (
            <tr key={f.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 font-medium text-slate-800">
                {f.n_factura ?? f.fra_abr ?? '—'}
                {f.tipo_documento === 'CUENTA_COBRO' && (
                  <span className="ml-1.5 chip bg-slate-100 text-slate-600">CC</span>
                )}
              </td>
              <td className="max-w-[240px] truncate px-3 py-2" title={f.tercero ?? ''}>
                {f.tercero ?? '—'}
              </td>
              <td className="px-3 py-2 tabular-nums text-slate-600">{f.nit ?? '—'}</td>
              <td className="px-3 py-2 tabular-nums text-slate-600">{fecha(f.fecha_emision)}</td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">{moneda(f.total, f.divisa)}</td>
              {mostrarArea && (
                <td className="px-3 py-2 text-slate-600">
                  {f.area ?? <span className="text-amber-600">Sin asignar</span>}
                </td>
              )}
              <td className="px-3 py-2">
                <EstadoChip estado={f.estado} />
              </td>
              <td className="px-3 py-2 tabular-nums text-slate-600">{f.cbte ?? '—'}</td>
              <td className="px-3 py-2">
                <ContabilizadoChip ok={f.cbte_ok} />
              </td>
              <td className="px-3 py-2 text-right">
                <Link
                  href={`/facturas/${f.id}`}
                  className="text-sm font-medium text-cofinet-700 hover:underline"
                >
                  Abrir
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
