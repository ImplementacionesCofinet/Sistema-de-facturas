'use client';

import { useActionState, useRef } from 'react';
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
          ? 'border border-marca-200 bg-marca-100 text-marca-700'
          : 'border border-tierra-200 bg-tierra-50 text-tierra-600'
      }`}
    >
      {estado.mensaje}
    </p>
  );
}

/** Aprobar o rechazar, con observaciones y documento soporte. */
export function FormularioDecision({ factura }: { factura: Factura }) {
  const [estado, accion, enviando] = useActionState(accionDecidir, ESTADO_INICIAL);
  const decisionRef = useRef<HTMLInputElement>(null);

  // La decision viaja en un campo propio del formulario en vez de depender del
  // name/value del boton pulsado. Ese dato lo agrega el navegador al enviar, y
  // si por lo que sea no llega, el servidor responde "Debe indicar si aprueba o
  // rechaza" aunque la persona si haya pulsado. Escribirlo aqui, en el mismo
  // clic y antes de que se envie el formulario, no depende de ese mecanismo.
  const marcarDecision = (valor: 'APROBADA' | 'RECHAZADA') => {
    if (decisionRef.current) decisionRef.current.value = valor;
  };

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="id" value={factura.id} />
      <input type="hidden" name="decision" ref={decisionRef} defaultValue="" />

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
          className="campo file:mr-3 file:rounded file:border-0 file:bg-pizarra-100 file:px-3 file:py-1 file:text-sm"
        />
        <p className="mt-1 text-xs text-pizarra-500">Opcional. Maximo 20 MB.</p>
      </div>

      <Aviso estado={estado} />

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          onClick={() => marcarDecision('APROBADA')}
          disabled={enviando}
          className="btn-primary"
        >
          {enviando ? 'Guardando…' : 'Aprobar'}
        </button>
        <button
          type="submit"
          onClick={() => marcarDecision('RECHAZADA')}
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
          className="campo file:mr-3 file:rounded file:border-0 file:bg-pizarra-100 file:px-3 file:py-1 file:text-sm"
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

      <label className="flex items-center gap-2 text-sm text-pizarra-600">
        <input
          type="checkbox"
          name="cbte_ok"
          defaultChecked={factura.cbte_ok}
          className="h-4 w-4 rounded border-pizarra-200 text-marca-700 focus:ring-marca-400"
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
          Asignar a
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
