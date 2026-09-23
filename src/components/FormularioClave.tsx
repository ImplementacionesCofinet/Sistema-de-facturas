'use client';

import { useActionState } from 'react';
import { accionCambiarClave, accionGenerarClaveTemporal } from '@/app/actions/clave';
import { ESTADO_CLAVE_INICIAL } from '@/lib/acciones';

export function FormularioCambiarClave({ obligatorio }: { obligatorio: boolean }) {
  const [estado, accion, enviando] = useActionState(accionCambiarClave, ESTADO_CLAVE_INICIAL);

  if (estado.ok) {
    return (
      <div className="space-y-4">
        <p className="aviso-ok">
          {estado.mensaje}
        </p>
        <a href="/facturas" className="btn-primary w-full">
          Continuar
        </a>
      </div>
    );
  }

  return (
    <form action={accion} className="space-y-4">
      {obligatorio && (
        <p className="aviso-info">
          Entro con una clave temporal. Debe cambiarla antes de continuar.
        </p>
      )}

      <div>
        <label className="etiqueta" htmlFor="actual">
          Contrasena actual
        </label>
        <input id="actual" name="actual" type="password" required autoComplete="current-password" className="campo" />
      </div>

      <div>
        <label className="etiqueta" htmlFor="nueva">
          Contrasena nueva
        </label>
        <input id="nueva" name="nueva" type="password" required autoComplete="new-password" className="campo" />
        <p className="mt-1 text-xs text-pizarra-500">
          Minimo 10 caracteres, combinando letras y numeros.
        </p>
      </div>

      <div>
        <label className="etiqueta" htmlFor="confirmacion">
          Confirme la contrasena nueva
        </label>
        <input id="confirmacion" name="confirmacion" type="password" required autoComplete="new-password" className="campo" />
      </div>

      {estado.mensaje && (
        <p role="status" className="aviso-error">
          {estado.mensaje}
        </p>
      )}

      <button type="submit" disabled={enviando} className="btn-primary w-full">
        {enviando ? 'Guardando…' : 'Cambiar contrasena'}
      </button>
    </form>
  );
}

/** Administracion: genera una clave temporal para un aprobador. */
export function BotonClaveTemporal({ correo, tieneClave }: { correo: string; tieneClave: boolean }) {
  const [estado, accion, enviando] = useActionState(
    accionGenerarClaveTemporal,
    ESTADO_CLAVE_INICIAL,
  );

  return (
    <div className="space-y-1">
      <form action={accion}>
        <input type="hidden" name="correo" value={correo} />
        <button type="submit" disabled={enviando} className="btn-secundario px-2.5 py-1 text-xs">
          {enviando ? '…' : tieneClave ? 'Restablecer clave' : 'Crear clave'}
        </button>
      </form>

      {estado.claveTemporal && (
        <p className="rounded border border-marca-200 bg-marca-100 px-2 py-1 text-xs text-marca-700">
          Clave temporal: <code className="font-bold">{estado.claveTemporal}</code>
        </p>
      )}
      {estado.mensaje && !estado.ok && (
        <p className="text-xs text-tierra-600">{estado.mensaje}</p>
      )}
    </div>
  );
}
