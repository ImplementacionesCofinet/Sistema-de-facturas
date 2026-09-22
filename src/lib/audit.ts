import 'server-only';
import type { PoolClient } from 'pg';
import { getPool } from './db';
import type { Factura } from './types';

export interface Cambio {
  campo: string;
  anterior: unknown;
  nuevo: unknown;
}

function aTexto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === 'boolean') return valor ? 'SI' : 'NO';
  const s = String(valor);
  return s === '' ? null : s;
}

/** Dos valores son iguales si su representacion textual coincide. */
export function sonIguales(a: unknown, b: unknown): boolean {
  return aTexto(a) === aTexto(b);
}

/**
 * Comparacion para columnas numericas. Postgres devuelve DECIMAL como texto
 * ('1500000.00') mientras que el Excel entrega un numero (1500000): sin esto,
 * cada importacion registraria un cambio inexistente en el total.
 */
export function sonIgualesNumericos(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined || b === null || b === undefined) {
    return sonIguales(a, b);
  }
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
  return sonIguales(a, b);
}

/**
 * Deja constancia de cada campo modificado: quien, cuando, valor anterior y
 * valor nuevo. Es la traza que reemplaza al historial de versiones de Excel.
 */
export async function registrarCambios(
  ejecutor: PoolClient | null,
  factura: Pick<Factura, 'id' | 'id_unico' | 'tercero' | 'area'>,
  cambios: Cambio[],
  usuario: string,
): Promise<void> {
  if (cambios.length === 0) return;

  const valores: unknown[] = [];
  const marcadores: string[] = [];

  cambios.forEach((cambio, i) => {
    const base = i * 8;
    marcadores.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`,
    );
    valores.push(
      factura.id,
      factura.id_unico,
      factura.tercero,
      factura.area,
      usuario,
      cambio.campo,
      aTexto(cambio.anterior),
      aTexto(cambio.nuevo),
    );
  });

  const sql = `
    INSERT INTO auditoria
      (factura_id, id_unico_ref, tercero, area, usuario, campo_modificado, valor_anterior, valor_nuevo)
    VALUES ${marcadores.join(', ')}
  `;

  if (ejecutor) {
    await ejecutor.query(sql, valores);
  } else {
    await getPool().query(sql, valores);
  }
}
