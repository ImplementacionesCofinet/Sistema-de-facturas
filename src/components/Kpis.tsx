import { moneda } from '@/lib/formato';
import type { Resumen } from '@/lib/facturas';

function Tarjeta({
  titulo,
  valor,
  acento,
}: {
  titulo: string;
  valor: string;
  acento?: string;
}) {
  return (
    <div className="tarjeta px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className={`mt-1 text-2xl font-bold ${acento ?? 'text-slate-800'}`}>{valor}</p>
    </div>
  );
}

export function Kpis({ resumen }: { resumen: Resumen }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Tarjeta titulo="Total" valor={String(resumen.total)} />
      <Tarjeta titulo="Pendientes" valor={String(resumen.pendientes)} acento="text-amber-600" />
      <Tarjeta titulo="Aprobadas" valor={String(resumen.aprobadas)} acento="text-emerald-600" />
      <Tarjeta titulo="Rechazadas" valor={String(resumen.rechazadas)} acento="text-red-600" />
      <Tarjeta
        titulo="Monto pendiente"
        valor={moneda(resumen.montoPendiente)}
        acento="text-slate-700"
      />
    </div>
  );
}
