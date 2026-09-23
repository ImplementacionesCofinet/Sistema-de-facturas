import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import {
  areasDisponibles,
  listarFacturas,
  obtenerResumen,
  periodosDisponibles,
  type FiltrosFactura,
} from '@/lib/facturas';
import { esContabilidad, type EstadoFactura } from '@/lib/types';
import { FiltrosFacturas } from '@/components/FiltrosFacturas';
import { Kpis } from '@/components/Kpis';
import { TablaFacturas } from '@/components/TablaFacturas';

export const dynamic = 'force-dynamic';

type Busqueda = Promise<Record<string, string | string[] | undefined>>;

function primer(valor: string | string[] | undefined, porDefecto: string): string {
  if (Array.isArray(valor)) return valor[0] ?? porDefecto;
  return valor ?? porDefecto;
}

export default async function PaginaFacturas({ searchParams }: { searchParams: Busqueda }) {
  const user = await requireUser();
  const params = await searchParams;

  const valores = {
    area: primer(params.area, 'TODAS'),
    estado: primer(params.estado, 'TODOS'),
    mes: primer(params.mes, 'TODOS'),
    contabilizado: primer(params.contabilizado, 'TODOS'),
    q: primer(params.q, ''),
  };
  const pagina = Math.max(1, Number(primer(params.pagina, '1')) || 1);

  const filtros: FiltrosFactura = {
    area: valores.area,
    estado: valores.estado as EstadoFactura | 'TODOS',
    mesPeriodo: valores.mes,
    contabilizado: valores.contabilizado as 'SI' | 'NO' | 'TODOS',
    busqueda: valores.q,
    pagina,
  };

  // El selector de area solo aparece para quien alcanza a ver mas de una.
  const mostrarArea = esContabilidad(user) || user.areas.length > 1;

  const [listado, resumen, areas, periodos] = await Promise.all([
    listarFacturas(user, filtros),
    obtenerResumen(user, filtros),
    // Un jefe de area solo recibe las suyas: el catalogo completo de la
    // compania no tiene por que viajar al navegador.
    mostrarArea && esContabilidad(user)
      ? areasDisponibles()
      : Promise.resolve(user.areas),
    periodosDisponibles(),
  ]);

  const totalPaginas = Math.max(1, Math.ceil(listado.total / listado.porPagina));
  const consulta = new URLSearchParams(
    Object.entries(valores).filter(([, v]) => v !== '') as [string, string][],
  );

  const enlacePagina = (n: number) => {
    const p = new URLSearchParams(consulta);
    p.set('pagina', String(n));
    return `/facturas?${p.toString()}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-marca-900">Facturas</h1>
          <p className="text-sm text-pizarra-500">
            {esContabilidad(user)
              ? 'Todas las areas de la compania.'
              : `Area${user.areas.length > 1 ? 's' : ''}: ${user.areas.join(', ') || 'sin asignar'}`}
          </p>
        </div>
        <a href={`/api/facturas/export?${consulta.toString()}`} className="btn-secundario">
          Exportar CSV
        </a>
      </div>

      <Kpis resumen={resumen} />

      <FiltrosFacturas
        valores={valores}
        areas={areas}
        periodos={periodos}
        mostrarArea={mostrarArea}
        permitirSinAsignar={esContabilidad(user)}
      />

      <TablaFacturas facturas={listado.facturas} />

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between text-sm text-pizarra-500">
          <p>
            {listado.total} facturas · pagina {listado.pagina} de {totalPaginas}
          </p>
          <div className="flex gap-2">
            {listado.pagina > 1 && (
              <Link href={enlacePagina(listado.pagina - 1)} className="btn-secundario">
                Anterior
              </Link>
            )}
            {listado.pagina < totalPaginas && (
              <Link href={enlacePagina(listado.pagina + 1)} className="btn-secundario">
                Siguiente
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
