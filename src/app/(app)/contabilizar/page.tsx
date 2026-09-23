import Link from 'next/link';
import { requireContabilidad } from '@/lib/auth';
import { listarFacturas } from '@/lib/facturas';
import { fecha, fechaHora, moneda, nombreDocumento } from '@/lib/formato';
import { FormularioComprobante } from '@/components/FormulariosFactura';

export const dynamic = 'force-dynamic';

/**
 * Bandeja de Contabilidad: facturas ya aprobadas por el jefe de area que
 * todavia no tienen comprobante de OASIS registrado.
 */
export default async function PaginaContabilizar() {
  const user = await requireContabilidad();

  const listado = await listarFacturas(user, {
    estado: 'APROBADA',
    contabilizado: 'NO',
    porPagina: 200,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-marca-900">Pendientes de contabilizar</h1>
        <p className="text-sm text-pizarra-500">
          Facturas aprobadas por el jefe de area. Registre el comprobante generado en OASIS y
          marque OK.
        </p>
      </div>

      {listado.facturas.length === 0 ? (
        <div className="tarjeta px-6 py-12 text-center text-sm text-pizarra-500">
          No hay facturas aprobadas pendientes de contabilizar.
        </div>
      ) : (
        <div className="tarjeta overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="border-b border-pizarra-200 bg-pizarra-50 text-left text-xs uppercase tracking-wide text-pizarra-500">
              <tr>
                <th className="px-3 py-2 font-semibold">N° Factura</th>
                <th className="px-3 py-2 font-semibold">Tercero</th>
                <th className="px-3 py-2 font-semibold">Emision</th>
                <th className="px-3 py-2 text-right font-semibold">Total</th>
                <th className="px-3 py-2 font-semibold">Area</th>
                <th className="px-3 py-2 font-semibold">Aprobada por</th>
                <th className="px-3 py-2 font-semibold">Comprobante OASIS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pizarra-100">
              {listado.facturas.map((f) => (
                <tr key={f.id} className="align-top hover:bg-pizarra-50">
                  <td className="px-3 py-3 font-medium">
                    <Link href={`/facturas/${f.id}`} className="text-marca-700 hover:underline">
                      {nombreDocumento(f)}
                    </Link>
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-3" title={f.tercero ?? ''}>
                    {f.tercero ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums text-pizarra-500">
                    {fecha(f.fecha_emision)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums font-medium">
                    {moneda(f.total, f.divisa)}
                  </td>
                  <td className="px-3 py-3 text-pizarra-500">{f.area ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-pizarra-500">
                    {f.aprobado_por ? (
                      <>
                        {f.aprobado_por}
                        <span className="block text-pizarra-400">
                          {fechaHora(f.fecha_aprobacion)}
                        </span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <FormularioComprobante factura={f} compacto />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-sm text-pizarra-500">{listado.total} factura(s) en esta bandeja.</p>
    </div>
  );
}
