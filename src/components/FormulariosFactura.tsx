'use client';

import { useActionState } from 'react';
import {
  accionAdjuntar,
  accionAsignarArea,
  accionComprobante,
  accionDecidir,
  accionPago,
} from '@/app/actions/facturas';
import { ESTADO_INICIAL, type EstadoAccion } from '@/lib/acciones';
import type { Factura } from '@/lib/types';

function Aviso({ estado }: { estado: EstadoAccion }) {
  if (!estado.mensaje) return null;
  return (
    <p
      role="status"
      className={`rounded-md px-3 py-2 text-sm ${
        estado.ok
          ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border border-red-200 bg-red-50 text-red-700'
      }`}
    >
      {estado.mensaje}
    </p>
  );
}

/** Aprobar o rechazar, con observaciones y documento soporte. */
export function FormularioDecision({ factura }: { factura: Factura }) {
  const [estado, accion, enviando] = useActionState(accionDecidir, ESTADO_INICIAL);

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="id" value={factura.id} />

      <div>
        <label className="etiqueta" htmlFor="observaciones">
          Observaciones
        </label>
        <textarea
          id="observaciones"
          name="observaciones"
          rows={3}
          defaultValue={factura.observaciones ?? ''}
          placeholder="Obligatorio al rechazar: indique el motivo."
          className="campo"
        />
      </div>

      <div>
        <label className="etiqueta" htmlFor="soporte">
          Documento soporte
        </label>
        <input
          id="soporte"
          name="soporte"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.xlsx,.xls,.csv,.doc,.docx,.txt,.zip,.xml"
          className="campo file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm"
        />
        <p className="mt-1 text-xs text-slate-500">Opcional. Maximo 20 MB.</p>
      </div>

      <Aviso estado={estado} />

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="decision"
          value="APROBADA"
          disabled={enviando}
          className="btn-primary"
        >
          {enviando ? 'Guardando…' : 'Aprobar'}
        </button>
        <button
          type="submit"
          name="decision"
          value="RECHAZADA"
          disabled={enviando}
          className="btn-peligro"
        >
          Rechazar
        </button>
      </div>
    </form>
  );
}

/** Actualizar observaciones o soporte sin cambiar la decision ya tomada. */
export function FormularioSoporte({ factura }: { factura: Factura }) {
  const [estado, accion, enviando] = useActionState(accionAdjuntar, ESTADO_INICIAL);

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="id" value={factura.id} />

      <div>
        <label className="etiqueta" htmlFor="observaciones-soporte">
          Observaciones
        </label>
        <textarea
          id="observaciones-soporte"
          name="observaciones"
          rows={3}
          defaultValue={factura.observaciones ?? ''}
          className="campo"
        />
      </div>

      <div>
        <label className="etiqueta" htmlFor="soporte-extra">
          Reemplazar documento soporte
        </label>
        <input
          id="soporte-extra"
          name="soporte"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.xlsx,.xls,.csv,.doc,.docx,.txt,.zip,.xml"
          className="campo file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm"
        />
      </div>

      <Aviso estado={estado} />

      <button type="submit" disabled={enviando} className="btn-secundario">
        {enviando ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  );
}

/** Contabilidad: comprobante de OASIS y marca de contabilizado. */
export function FormularioComprobante({
  factura,
  compacto = false,
}: {
  factura: Factura;
  compacto?: boolean;
}) {
  const [estado, accion, enviando] = useActionState(accionComprobante, ESTADO_INICIAL);

  return (
    <form action={accion} className={compacto ? 'flex flex-wrap items-center gap-2' : 'space-y-4'}>
      <input type="hidden" name="id" value={factura.id} />

      <div className={compacto ? '' : ''}>
        {!compacto && (
          <label className="etiqueta" htmlFor={`cbte-${factura.id}`}>
            Comprobante OASIS (Cbte)
          </label>
        )}
        <input
          id={`cbte-${factura.id}`}
          name="cbte"
          defaultValue={factura.cbte ?? ''}
          placeholder="N° de comprobante"
          aria-label="Comprobante OASIS"
          className={compacto ? 'campo w-40' : 'campo'}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="cbte_ok"
          defaultChecked={factura.cbte_ok}
          className="h-4 w-4 rounded border-slate-300 text-cofinet-600 focus:ring-cofinet-400"
        />
        Contabilizada (OK)
      </label>

      <button type="submit" disabled={enviando} className="btn-primary">
        {enviando ? 'Guardando…' : 'Registrar'}
      </button>

      <div className={compacto ? 'w-full' : ''}>
        <Aviso estado={estado} />
      </div>
    </form>
  );
}

/** Contabilidad: asignacion del area responsable. */
export function FormularioArea({ factura, areas }: { factura: Factura; areas: string[] }) {
  const [estado, accion, enviando] = useActionState(accionAsignarArea, ESTADO_INICIAL);

  return (
    <form action={accion} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={factura.id} />
      <div className="min-w-[180px] flex-1">
        <label className="etiqueta" htmlFor={`area-${factura.id}`}>
          Area responsable
        </label>
        <select
          id={`area-${factura.id}`}
          name="area"
          defaultValue={factura.area ?? ''}
          className="campo"
        >
          <option value="">Seleccione…</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={enviando} className="btn-secundario">
        {enviando ? 'Guardando…' : 'Asignar'}
      </button>
      <div className="w-full">
        <Aviso estado={estado} />
      </div>
    </form>
  );
}

/** Contabilidad: forma y estado de pago. */
export function FormularioPago({ factura }: { factura: Factura }) {
  const [estado, accion, enviando] = useActionState(accionPago, ESTADO_INICIAL);

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={factura.id} />

      <div>
        <label className="etiqueta" htmlFor="forma_pago">
          Forma de pago
        </label>
        <input
          id="forma_pago"
          name="forma_pago"
          defaultValue={factura.forma_pago ?? ''}
          placeholder="Transferencia, caja menor…"
          className="campo"
        />
      </div>

      <div>
        <label className="etiqueta" htmlFor="estado_pago">
          Estado de pago
        </label>
        <select
          id="estado_pago"
          name="estado_pago"
          defaultValue={factura.estado_pago ?? ''}
          className="campo"
        >
          <option value="">Sin definir</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="PROGRAMADO">Programado</option>
          <option value="PAGADO">Pagado</option>
          <option value="ANULADO">Anulado</option>
        </select>
      </div>

      <div className="sm:col-span-2">
        <Aviso estado={estado} />
      </div>

      <div className="sm:col-span-2">
        <button type="submit" disabled={enviando} className="btn-secundario">
          {enviando ? 'Guardando…' : 'Actualizar pago'}
        </button>
      </div>
    </form>
  );
}
