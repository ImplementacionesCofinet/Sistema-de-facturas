'use client';

import { useActionState } from 'react';
import {
  ESTADO_APROBADOR_INICIAL,
  accionCambiarEstadoAprobador,
  accionGuardarAprobador,
} from '@/app/actions/aprobadores';

export function FormularioAprobador({ areas }: { areas: string[] }) {
  const [estado, accion, enviando] = useActionState(
    accionGuardarAprobador,
    ESTADO_APROBADOR_INICIAL,
  );

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div>
        <label className="etiqueta" htmlFor="nombre">
          Nombre
        </label>
        <input id="nombre" name="nombre" required className="campo" />
      </div>

      <div>
        <label className="etiqueta" htmlFor="correo">
          Correo corporativo
        </label>
        <input id="correo" name="correo" type="email" required className="campo" />
      </div>

      <div>
        <label className="etiqueta" htmlFor="area">
          Area
        </label>
        <input
          id="area"
          name="area"
          required
          list="areas-existentes"
          placeholder="LOGISTICA"
          className="campo"
        />
        <datalist id="areas-existentes">
          {areas.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </div>

      <div>
        <label className="etiqueta" htmlFor="rol">
          Rol
        </label>
        <select id="rol" name="rol" defaultValue="APROBADOR" className="campo">
          <option value="APROBADOR">Jefe de area</option>
          <option value="CONTABILIDAD">Contabilidad</option>
          <option value="ADMIN">Administrador</option>
        </select>
      </div>

      <div className="flex items-end">
        <button type="submit" disabled={enviando} className="btn-primary w-full">
          {enviando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      {estado.mensaje && (
        <p
          role="status"
          className={`sm:col-span-2 lg:col-span-5 rounded-md px-3 py-2 text-sm ${
            estado.ok
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {estado.mensaje}
        </p>
      )}
    </form>
  );
}

export function BotonEstadoAprobador({ id, activo }: { id: string; activo: boolean }) {
  const [, accion, enviando] = useActionState(
    accionCambiarEstadoAprobador,
    ESTADO_APROBADOR_INICIAL,
  );

  return (
    <form action={accion}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="activo" value={activo ? 'false' : 'true'} />
      <button type="submit" disabled={enviando} className="btn-secundario px-2.5 py-1 text-xs">
        {activo ? 'Desactivar' : 'Activar'}
      </button>
    </form>
  );
}
