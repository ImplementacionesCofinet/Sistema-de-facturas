'use client';

import { useActionState } from 'react';
import { accionImportar } from '@/app/actions/importar';
import { ESTADO_IMPORTACION_INICIAL } from '@/lib/acciones';

export function FormularioImportacion() {
  const [estado, accion, enviando] = useActionState(accionImportar, ESTADO_IMPORTACION_INICIAL);

  return (
    <div className="space-y-4">
      <form action={accion} className="space-y-4">
        <div>
          <label className="etiqueta" htmlFor="archivo">
            Archivo de la DIAN
          </label>
          <input
            id="archivo"
            name="archivo"
            type="file"
            required
            accept=".xlsx,.xlsm,.csv"
            className="campo file:mr-3 file:rounded file:border-0 file:bg-pizarra-100 file:px-3 file:py-1 file:text-sm"
          />
          <p className="mt-1 text-xs text-pizarra-500">
            Formatos .xlsx o .csv, hasta 25 MB. Si la DIAN entrego un .xls, abralo en Excel y
            guardelo como .xlsx.
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="etiqueta">Modo de importacion</legend>

          <label className="flex items-start gap-2 rounded-md border border-pizarra-200 p-3 text-sm">
            <input type="radio" name="modo" value="dian" defaultChecked className="mt-0.5" />
            <span>
              <span className="font-medium text-marca-800">Importacion mensual (DIAN)</span>
              <span className="block text-xs text-pizarra-500">
                Agrega las facturas nuevas y refresca los datos del documento. Nunca modifica
                aprobaciones, observaciones, soportes ni comprobantes ya registrados.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 rounded-md border border-pizarra-200 p-3 text-sm">
            <input type="radio" name="modo" value="migracion" className="mt-0.5" />
            <span>
              <span className="font-medium text-marca-800">Carga inicial del Excel historico</span>
              <span className="block text-xs text-pizarra-500">
                Ademas de lo anterior, completa area, estado, comprobante y observaciones cuando
                esos campos aun esten vacios en la app. Usar solo en la migracion.
              </span>
            </span>
          </label>
        </fieldset>

        <button type="submit" disabled={enviando} className="btn-primary">
          {enviando ? 'Procesando archivo…' : 'Importar'}
        </button>
      </form>

      {estado.mensaje && (
        <div
          role="status"
          className={`rounded-md px-4 py-3 text-sm ${
            estado.ok
              ? 'border border-marca-200 bg-marca-100 text-marca-700'
              : 'border border-tierra-200 bg-tierra-50 text-tierra-600'
          }`}
        >
          <p className="font-medium">{estado.mensaje}</p>

          {estado.resultado && (
            <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              <div>
                <dt className="text-xs uppercase tracking-wide opacity-70">Filas leidas</dt>
                <dd className="text-lg font-bold">{estado.resultado.totalFilas}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide opacity-70">Nuevas</dt>
                <dd className="text-lg font-bold">{estado.resultado.filasNuevas}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide opacity-70">Actualizadas</dt>
                <dd className="text-lg font-bold">{estado.resultado.filasActualizadas}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide opacity-70">Sin cambios</dt>
                <dd className="text-lg font-bold">{estado.resultado.filasSinCambios}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide opacity-70">Sin procesar</dt>
                <dd className="text-lg font-bold">{estado.resultado.filasIgnoradas}</dd>
              </div>
            </dl>
          )}

          {estado.resultado && estado.resultado.errores.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium">
                Ver {estado.resultado.errores.length} advertencia(s)
              </summary>
              <ul className="mt-2 max-h-56 list-disc space-y-1 overflow-y-auto pl-5 text-xs">
                {estado.resultado.errores.slice(0, 200).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
