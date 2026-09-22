import { periodo } from '@/lib/formato';
import { AREA_SIN_ASIGNAR } from '@/lib/types';

export interface ValoresFiltro {
  area: string;
  estado: string;
  mes: string;
  contabilizado: string;
  q: string;
}

export function FiltrosFacturas({
  valores,
  areas,
  periodos,
  mostrarArea,
  permitirSinAsignar = false,
  accion = '/facturas',
}: {
  valores: ValoresFiltro;
  areas: string[];
  periodos: string[];
  mostrarArea: boolean;
  permitirSinAsignar?: boolean;
  accion?: string;
}) {
  return (
    <form
      method="get"
      action={accion}
      className="tarjeta grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6"
    >
      <div className="lg:col-span-2">
        <label className="etiqueta" htmlFor="q">
          Buscar
        </label>
        <input
          id="q"
          name="q"
          defaultValue={valores.q}
          placeholder="Tercero, NIT, N° factura o Cbte"
          className="campo"
        />
      </div>

      {mostrarArea && (
        <div>
          <label className="etiqueta" htmlFor="area">
            Area
          </label>
          <select id="area" name="area" defaultValue={valores.area} className="campo">
            <option value="TODAS">Todas</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
            {permitirSinAsignar && <option value={AREA_SIN_ASIGNAR}>Sin asignar</option>}
          </select>
        </div>
      )}

      <div>
        <label className="etiqueta" htmlFor="estado">
          Estado
        </label>
        <select id="estado" name="estado" defaultValue={valores.estado} className="campo">
          <option value="TODOS">Todos</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="APROBADA">Aprobada</option>
          <option value="RECHAZADA">Rechazada</option>
        </select>
      </div>

      <div>
        <label className="etiqueta" htmlFor="mes">
          Periodo
        </label>
        <select id="mes" name="mes" defaultValue={valores.mes} className="campo">
          <option value="TODOS">Todos</option>
          {periodos.map((p) => (
            <option key={p} value={p}>
              {periodo(p)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="etiqueta" htmlFor="contabilizado">
          Contabilizado
        </label>
        <select
          id="contabilizado"
          name="contabilizado"
          defaultValue={valores.contabilizado}
          className="campo"
        >
          <option value="TODOS">Todos</option>
          <option value="NO">Sin contabilizar</option>
          <option value="SI">Contabilizadas</option>
        </select>
      </div>

      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
        <button type="submit" className="btn-primary">
          Filtrar
        </button>
        <a href={accion} className="btn-secundario">
          Limpiar
        </a>
      </div>
    </form>
  );
}
