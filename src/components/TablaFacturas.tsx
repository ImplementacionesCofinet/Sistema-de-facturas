import Link from 'next/link';
import { ContabilizadoChip, EstadoChip } from './EstadoChip';
import { fecha, moneda, nombreDocumento } from '@/lib/formato';
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
      <div className="tarjeta px-6 py-12 text-center text-sm text-pizarra-500">
        No hay facturas que coincidan con los filtros seleccionados.
      </div>
    );
  }

  return (
    <div className="tarjeta overflow-x-auto">
      <table className="tabla min-w-[900px]">
        <thead>
          <tr>
            <th>N° Factura</th>
            <th>Tercero</th>
            <th>NIT</th>
            <th>Emision</th>
            <th className="text-right">Total</th>
            {mostrarArea && <th>Area</th>}
            <th>Estado</th>
            <th>Cbte</th>
            <th>OK</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {facturas.map((f) => (
            <tr key={f.id}>
              <td className="font-medium text-marca-900">
                {nombreDocumento(f)}
                {f.tipo_documento === 'CUENTA_COBRO' && (
                  <span className="chip ml-1.5 bg-pizarra-100 text-pizarra-500">CC</span>
                )}
              </td>
              <td className="max-w-[240px] truncate" title={f.tercero ?? ''}>
                {f.tercero ?? '—'}
              </td>
              <td className="tabular-nums text-pizarra-500">{f.nit ?? '—'}</td>
              <td className="tabular-nums text-pizarra-500">{fecha(f.fecha_emision)}</td>
              <td className="text-right font-semibold tabular-nums text-marca-900">
                {moneda(f.total, f.divisa)}
              </td>
              {mostrarArea && (
                <td className="text-pizarra-600">
                  {f.area ?? <span className="text-tierra-600">Sin asignar</span>}
                </td>
              )}
              <td>
                <EstadoChip estado={f.estado} />
              </td>
              <td className="tabular-nums text-pizarra-500">{f.cbte ?? '—'}</td>
              <td>
                <ContabilizadoChip ok={f.cbte_ok} />
              </td>
              <td className="text-right">
                <Link
                  href={`/facturas/${f.id}`}
                  className="text-sm font-semibold text-marca-700 hover:text-marca-500 hover:underline"
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
