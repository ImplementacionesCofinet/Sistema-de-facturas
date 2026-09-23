import { type NextRequest, NextResponse } from 'next/server';
import { obtenerSesion } from '@/lib/session';
import { listarFacturas } from '@/lib/facturas';
import type { EstadoFactura } from '@/lib/types';

export const dynamic = 'force-dynamic';

const COLUMNAS: { titulo: string; campo: string }[] = [
  { titulo: 'ID unico', campo: 'id_unico' },
  { titulo: 'Tipo', campo: 'tipo_documento' },
  { titulo: 'N Factura', campo: 'n_factura' },
  { titulo: 'Fra abr', campo: 'fra_abr' },
  { titulo: 'Fecha emision', campo: 'fecha_emision' },
  { titulo: 'Fecha recepcion', campo: 'fecha_recepcion' },
  { titulo: 'NIT', campo: 'nit' },
  { titulo: 'Tercero', campo: 'tercero' },
  { titulo: 'Total', campo: 'total' },
  { titulo: 'Divisa', campo: 'divisa' },
  { titulo: 'Area', campo: 'area' },
  { titulo: 'Estado', campo: 'estado' },
  { titulo: 'Cbte', campo: 'cbte' },
  { titulo: 'OK', campo: 'cbte_ok' },
  { titulo: 'OK fecha', campo: 'cbte_ok_fecha' },
  { titulo: 'OK usuario', campo: 'cbte_ok_usuario' },
  { titulo: 'Observaciones', campo: 'observaciones' },
  { titulo: 'Documento ref', campo: 'documento_ref' },
  { titulo: 'Forma de pago', campo: 'forma_pago' },
  { titulo: 'Estado pago', campo: 'estado_pago' },
  { titulo: 'Fecha aprobacion', campo: 'fecha_aprobacion' },
  { titulo: 'Aprobado por', campo: 'aprobado_por' },
  { titulo: 'Periodo', campo: 'mes_periodo' },
];

function celda(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'boolean') return valor ? 'OK' : '';
  const texto = valor instanceof Date ? valor.toISOString() : String(valor);
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** Exporta el listado visible al usuario, respetando sus filtros y su area. */
export async function GET(request: NextRequest) {
  const user = await obtenerSesion();
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });

  const p = request.nextUrl.searchParams;
  const { facturas } = await listarFacturas(user, {
    area: p.get('area') ?? 'TODAS',
    estado: (p.get('estado') ?? 'TODOS') as EstadoFactura | 'TODOS',
    mesPeriodo: p.get('mes') ?? 'TODOS',
    contabilizado: (p.get('contabilizado') ?? 'TODOS') as 'SI' | 'NO' | 'TODOS',
    busqueda: p.get('q') ?? '',
    pagina: 1,
    porPagina: 200,
  });

  // Delimitador ';' y BOM para que Excel en espanol abra el archivo bien.
  const lineas = [
    COLUMNAS.map((c) => c.titulo).join(';'),
    ...facturas.map((f) =>
      COLUMNAS.map((c) => celda((f as unknown as Record<string, unknown>)[c.campo])).join(';'),
    ),
  ];

  const nombre = `facturas-cofinet-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(`﻿${lineas.join('\r\n')}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nombre}"`,
    },
  });
}
