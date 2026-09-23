import { moneda } from '@/lib/formato';
import type { Resumen } from '@/lib/facturas';

function Tarjeta({
  titulo,
  valor,
  acento,
  barra,
}: {
  titulo: string;
  valor: string;
  acento: string;
  barra: string;
}) {
  return (
    <div className="tarjeta relative overflow-hidden px-4 py-3">
      <span className={`absolute inset-y-0 left-0 w-1 ${barra}`} aria-hidden />
      <p className="titulo-seccion">{titulo}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${acento}`}>{valor}</p>
    </div>
  );
}

export function Kpis({ resumen }: { resumen: Resumen }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Tarjeta titulo="Total" valor={String(resumen.total)} acento="text-marca-900" barra="bg-pizarra-300" />
      <Tarjeta titulo="Pendientes" valor={String(resumen.pendientes)} acento="text-tierra-600" barra="bg-tierra-400" />
      <Tarjeta titulo="Aprobadas" valor={String(resumen.aprobadas)} acento="text-marca-600" barra="bg-marca-500" />
      <Tarjeta titulo="Rechazadas" valor={String(resumen.rechazadas)} acento="text-vino-600" barra="bg-vino-500" />
      <Tarjeta
        titulo="Monto pendiente"
        valor={moneda(resumen.montoPendiente)}
        acento="text-marca-800"
        barra="bg-marca-700"
      />
    </div>
  );
}
