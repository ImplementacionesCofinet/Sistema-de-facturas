import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Aplica las migraciones pendientes de db/migrations.
 *
 * Lo comparten el arranque de la aplicacion y el comando `npm run db:migrate`,
 * para que no haya dos versiones de la misma logica.
 *
 * @param {{ query: (texto: string, valores?: unknown[]) => Promise<{ rows: any[] }> }} cliente
 *   Conexion dedicada (no un pool): el bloqueo de Postgres es por sesion y se
 *   perderia si cada consulta saliera por una conexion distinta.
 * @param {{ directorio?: string, registrar?: (mensaje: string) => void }} [opciones]
 * @returns {Promise<{ aplicadas: string[], yaEstaban: string[] }>}
 */
export async function aplicarMigraciones(cliente, opciones = {}) {
  const directorio = opciones.directorio ?? path.resolve(process.cwd(), 'db/migrations');
  const registrar = opciones.registrar ?? (() => {});

  // Evita que dos arranques simultaneos apliquen la misma migracion a la vez.
  await cliente.query('SELECT pg_advisory_lock($1)', [728491]);

  try {
    await cliente.query(`
      CREATE TABLE IF NOT EXISTS _migraciones (
        nombre      TEXT PRIMARY KEY,
        aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const yaAplicadas = new Set(
      (await cliente.query('SELECT nombre FROM _migraciones')).rows.map((f) => f.nombre),
    );

    const archivos = (await readdir(directorio)).filter((f) => f.endsWith('.sql')).sort();

    const aplicadas = [];
    const yaEstaban = [];

    for (const archivo of archivos) {
      if (yaAplicadas.has(archivo)) {
        yaEstaban.push(archivo);
        continue;
      }

      const sql = await readFile(path.join(directorio, archivo), 'utf8');
      try {
        await cliente.query('BEGIN');
        await cliente.query(sql);
        await cliente.query('INSERT INTO _migraciones (nombre) VALUES ($1)', [archivo]);
        await cliente.query('COMMIT');
        aplicadas.push(archivo);
        registrar(`+ ${archivo} aplicada`);
      } catch (error) {
        await cliente.query('ROLLBACK');
        throw new Error(
          `Error aplicando ${archivo}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    return { aplicadas, yaEstaban };
  } finally {
    await cliente.query('SELECT pg_advisory_unlock($1)', [728491]);
  }
}
