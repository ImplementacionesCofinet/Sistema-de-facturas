import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { env } from './env';

/**
 * Pool unico de Postgres. En desarrollo Next.js recarga los modulos en cada
 * cambio, por eso se guarda en globalThis y no se abren decenas de pools.
 */
const globalForDb = globalThis as unknown as { __cofinetPool?: Pool };

export function getPool(): Pool {
  if (!globalForDb.__cofinetPool) {
    const connectionString = env.databaseUrl;
    const needsSsl =
      process.env.PGSSLMODE === 'require' ||
      /[?&]sslmode=require/.test(connectionString) ||
      /supabase\.(co|com)|neon\.tech|render\.com|railway\.app/.test(connectionString);

    globalForDb.__cofinetPool = new Pool({
      connectionString,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.PGPOOL_MAX || 10),
      idleTimeoutMillis: 30_000,
    });
  }
  return globalForDb.__cofinetPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Ejecuta fn dentro de una transaccion; hace rollback ante cualquier error. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
