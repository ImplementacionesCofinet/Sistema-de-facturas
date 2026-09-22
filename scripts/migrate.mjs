import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';
import { cargarEnv } from './env-file.mjs';

cargarEnv();

const DIRECTORIO = path.resolve('db/migrations');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Falta DATABASE_URL (ver .env.example).');

  const necesitaSsl =
    process.env.PGSSLMODE === 'require' ||
    /[?&]sslmode=require/.test(connectionString) ||
    /supabase\.(co|com)|neon\.tech|render\.com|railway\.app/.test(connectionString);

  const client = new Client({
    connectionString,
    ssl: necesitaSsl ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS _migraciones (
      nombre     TEXT PRIMARY KEY,
      aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const aplicadas = new Set(
    (await client.query('SELECT nombre FROM _migraciones')).rows.map((f) => f.nombre),
  );

  const archivos = (await readdir(DIRECTORIO)).filter((f) => f.endsWith('.sql')).sort();

  for (const archivo of archivos) {
    if (aplicadas.has(archivo)) {
      console.log(`= ${archivo} (ya aplicada)`);
      continue;
    }
    const sql = await readFile(path.join(DIRECTORIO, archivo), 'utf8');
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migraciones (nombre) VALUES ($1)', [archivo]);
      await client.query('COMMIT');
      console.log(`+ ${archivo} aplicada`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(
        `Error aplicando ${archivo}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  await client.end();
  console.log('Migraciones al dia.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
