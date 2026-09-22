import { requireContabilidad } from '@/lib/auth';
import { listarImportaciones } from '@/lib/importacion';
import { fechaHora } from '@/lib/formato';
import { FormularioImportacion } from '@/components/FormularioImportacion';

export const dynamic = 'force-dynamic';

export default async function PaginaImportar() {
  await requireContabilidad();
  const importaciones = await listarImportaciones(30);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Importar facturas de la DIAN</h1>
        <p className="text-sm text-slate-500">
          Cargue aqui el archivo mensual descargado del portal de la DIAN. La app reconoce las
          columnas automaticamente, ignora las filas ya registradas y deja constancia de cada
          cambio.
        </p>
      </div>

      <section className="tarjeta p-5">
        <FormularioImportacion />
      </section>

      <section className="tarjeta p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Importaciones anteriores
        </h2>

        {importaciones.length === 0 ? (
          <p className="text-sm text-slate-500">Todavia no se ha importado ningun archivo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Archivo</th>
                  <th className="px-3 py-2 font-semibold">Importado por</th>
                  <th className="px-3 py-2 font-semibold">Fecha y hora</th>
                  <th className="px-3 py-2 text-right font-semibold">Filas</th>
                  <th className="px-3 py-2 text-right font-semibold">Nuevas</th>
                  <th className="px-3 py-2 text-right font-semibold">Actualizadas</th>
                  <th className="px-3 py-2 text-right font-semibold">Sin cambios</th>
                  <th className="px-3 py-2 text-right font-semibold">Sin procesar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {importaciones.map((imp) => (
                  <tr key={imp.id}>
                    <td className="max-w-[260px] truncate px-3 py-2 font-medium text-slate-800">
                      {imp.nombre_archivo ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{imp.importado_por ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600">
                      {fechaHora(imp.importado_en)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{imp.total_filas}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                      {imp.filas_nuevas}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-cofinet-700">
                      {imp.filas_actualizadas}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                      {imp.filas_sin_cambios}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-amber-700">
                      {imp.filas_ignoradas}
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
