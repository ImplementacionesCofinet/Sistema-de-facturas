import type { EstadoFactura } from '@/lib/types';

const ESTILOS: Record<EstadoFactura, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-800',
  APROBADA: 'bg-emerald-100 text-emerald-800',
  RECHAZADA: 'bg-red-100 text-red-700',
};

export function EstadoChip({ estado }: { estado: EstadoFactura }) {
  return <span className={`chip ${ESTILOS[estado] ?? 'bg-slate-100 text-slate-600'}`}>{estado}</span>;
}

export function ContabilizadoChip({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="chip bg-cofinet-100 text-cofinet-800">OK</span>
  ) : (
    <span className="chip bg-slate-100 text-slate-500">—</span>
  );
}
