import type { EstadoFactura } from '@/lib/types';

const ESTILOS: Record<EstadoFactura, string> = {
  PENDIENTE: 'bg-tierra-100 text-tierra-700',
  APROBADA: 'bg-marca-200 text-marca-700',
  RECHAZADA: 'bg-vino-100 text-vino-700',
};

export function EstadoChip({ estado }: { estado: EstadoFactura }) {
  return (
    <span className={`chip ${ESTILOS[estado] ?? 'bg-pizarra-100 text-pizarra-600'}`}>
      {estado}
    </span>
  );
}

export function ContabilizadoChip({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="chip bg-marca-200 text-marca-700">OK</span>
  ) : (
    <span className="chip bg-pizarra-100 text-pizarra-400">—</span>
  );
}
