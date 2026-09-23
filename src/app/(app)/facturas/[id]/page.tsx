import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { areasDisponibles, historialFactura, obtenerFactura } from '@/lib/facturas';
import { fecha, fechaHora, moneda, periodo } from '@/lib/formato';
import { esContabilidad, puedeVerArea } from '@/lib/types';
import { ContabilizadoChip, EstadoChip } from '@/components/EstadoChip';
import {
  FormularioArea,
  FormularioComprobante,
  FormularioDecision,
  FormularioPago,
  FormularioSoporte,
} from '@/components/FormulariosFactura';

export const dynamic = 'force-dynamic';

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="titulo-seccion">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm text-marca-900">{children}</dd>
    </div>
  );
}

export default async function DetalleFactura({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const factura = await obtenerFactura(id);
  if (!factura) notFound();

  if (!puedeVerArea(user, factura.area)) {
    return (
      <div className="tarjeta p-8 text-center">
        <h1 className="text-lg font-semibold text-marca-800">Sin acceso</h1>
        <p className="mt-2 text-sm text-pizarra-500">
          Esta factura pertenece al area {factura.area ?? 'sin asignar'} y usted no tiene permiso
          sobre ella.
        </p>
        <Link href="/facturas" className="btn-secundario mt-4">
          Volver a facturas
        </Link>
      </div>
    );
  }

  const [historial, areas] = await Promise.all([
    historialFactura(factura.id),
    esContabilidad(user) ? areasDisponibles() : Promise.resolve<string[]>([]),
  ]);

  const contabilidad = esContabilidad(user);
  const puedeDecidir = !factura.cbte_ok;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/facturas" className="text-sm font-medium text-marca-700 hover:text-marca-500 hover:underline">
            ← Volver a facturas
          </Link>
          <h1 className="mt-1 text-xl font-bold text-marca-900">
            {factura.n_factura ?? factura.fra_abr ?? factura.id_unico}
          </h1>
          <p className="text-sm text-pizarra-500">{factura.tercero ?? 'Tercero sin nombre'}</p>
        </div>
        <div className="flex items-center gap-2">
          <EstadoChip estado={factura.estado} />
          <ContabilizadoChip ok={factura.cbte_ok} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="tarjeta p-5 lg:col-span-2">
          <h2 className="titulo-seccion mb-4">
            Datos del documento
          </h2>
          <dl className="grid gap-4 sm:grid-cols-3">
            <Dato etiqueta="Tipo">{factura.tipo_documento.replace('_', ' ')}</Dato>
            <Dato etiqueta="N° Factura">{factura.n_factura ?? '—'}</Dato>
            <Dato etiqueta="Fra abr">{factura.fra_abr ?? '—'}</Dato>
            <Dato etiqueta="NIT">{factura.nit ?? '—'}</Dato>
            <Dato etiqueta="Tercero">{factura.tercero ?? '—'}</Dato>
            <Dato etiqueta="Total">
              <span className="font-semibold">{moneda(factura.total, factura.divisa)}</span>
            </Dato>
            <Dato etiqueta="Fecha emision">{fecha(factura.fecha_emision)}</Dato>
            <Dato etiqueta="Fecha recepcion">{fechaHora(factura.fecha_recepcion)}</Dato>
            <Dato etiqueta="Divisa">{factura.divisa ?? 'COP'}</Dato>
            <Dato etiqueta="Periodo">{periodo(factura.mes_periodo)}</Dato>
            <Dato etiqueta="Area">{factura.area ?? 'Sin asignar'}</Dato>
            <Dato etiqueta="Forma de pago">{factura.forma_pago ?? '—'}</Dato>
            <Dato etiqueta="Estado de pago">{factura.estado_pago ?? '—'}</Dato>
            <Dato etiqueta="Comprobante (Cbte)">{factura.cbte ?? '—'}</Dato>
            <Dato etiqueta="Contabilizado por">
              {factura.cbte_ok_usuario ?? '—'}
              {factura.cbte_ok_fecha && (
                <span className="block text-xs text-pizarra-500">
                  {fechaHora(factura.cbte_ok_fecha)}
                </span>
              )}
            </Dato>
            <Dato etiqueta="Aprobado / rechazado por">
              {factura.aprobado_por ?? '—'}
              {factura.fecha_aprobacion && (
                <span className="block text-xs text-pizarra-500">
                  {fechaHora(factura.fecha_aprobacion)}
                </span>
              )}
            </Dato>
            <Dato etiqueta="ID unico">
              <code className="text-xs text-pizarra-500">{factura.id_unico}</code>
            </Dato>
            {factura.cufe && (
              <Dato etiqueta="CUFE">
                <code className="break-all text-xs text-pizarra-500">{factura.cufe}</code>
              </Dato>
            )}
          </dl>

          {factura.observaciones && (
            <div className="mt-5 rounded-md border border-tierra-200 bg-tierra-50 p-3">
              <p className="titulo-seccion">
                Observaciones
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-pizarra-600">
                {factura.observaciones}
              </p>
            </div>
          )}

          {factura.documento_ref && (
            <p className="mt-4 text-sm">
              <a
                href={factura.documento_ref}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-marca-700 hover:text-marca-500 hover:underline"
              >
                Ver documento soporte adjunto
              </a>
            </p>
          )}
        </section>

        <div className="space-y-5">
          <section className="tarjeta p-5">
            <h2 className="titulo-seccion mb-4">
              {puedeDecidir ? 'Aprobacion' : 'Soporte y observaciones'}
            </h2>
            {puedeDecidir ? (
              <FormularioDecision factura={factura} />
            ) : (
              <>
                <p className="mb-3 rounded-md border border-pizarra-200 bg-pizarra-50 px-3 py-2 text-sm text-pizarra-500">
                  La factura ya fue contabilizada en OASIS; la decision no se puede cambiar.
                </p>
                <FormularioSoporte factura={factura} />
              </>
            )}
          </section>

          {contabilidad && (
            <>
              <section className="tarjeta p-5">
                <h2 className="titulo-seccion mb-4">
                  Contabilizacion
                </h2>
                <FormularioComprobante factura={factura} />
              </section>

              <section className="tarjeta p-5">
                <h2 className="titulo-seccion mb-4">
                  Area responsable
                </h2>
                <FormularioArea factura={factura} areas={areas} />
              </section>

              <section className="tarjeta p-5">
                <h2 className="titulo-seccion mb-4">
                  Pago
                </h2>
                <FormularioPago factura={factura} />
              </section>
            </>
          )}
        </div>
      </div>

      <section className="tarjeta p-5">
        <h2 className="titulo-seccion mb-4">
          Historial de cambios ({historial.length})
        </h2>
        {historial.length === 0 ? (
          <p className="text-sm text-pizarra-500">Todavia no hay cambios registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-pizarra-200 text-left text-xs uppercase tracking-wide text-pizarra-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Fecha y hora</th>
                  <th className="px-3 py-2 font-semibold">Usuario</th>
                  <th className="px-3 py-2 font-semibold">Campo</th>
                  <th className="px-3 py-2 font-semibold">Antes</th>
                  <th className="px-3 py-2 font-semibold">Despues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pizarra-100">
                {historial.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-pizarra-500">
                      {fechaHora(r.fecha_cambio)}
                    </td>
                    <td className="px-3 py-2 text-pizarra-600">{r.usuario ?? '—'}</td>
                    <td className="px-3 py-2 font-medium text-pizarra-600">{r.campo_modificado}</td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-pizarra-500">
                      {r.valor_anterior ?? '—'}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-marca-800">
                      {r.valor_nuevo ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
