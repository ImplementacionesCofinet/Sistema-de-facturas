import { execFile } from 'node:child_process';
import { mkdir, readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { cargarEnv } from './env-file.mjs';

const ejecutar = promisify(execFile);
cargarEnv();

/**
 * Respaldo de la base de datos. Como la app es el registro oficial de las
 * facturas, conviene programarlo a diario (Programador de tareas en Windows,
 * cron en Linux).
 *
 *   node scripts/respaldo.mjs [carpeta] [dias_a_conservar]
 *
 * Requiere pg_dump en el PATH. Con Docker se usa en su lugar:
 *   docker compose exec -T base-de-datos pg_dump ... > respaldos/archivo.sql
 */
const carpeta = process.argv[2] || process.env.CARPETA_RESPALDOS || './respaldos';
const diasConservar = Number(process.argv[3] || process.env.DIAS_RESPALDO || 30);

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL (ver .env.example).');

  await mkdir(carpeta, { recursive: true });

  const marca = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const destino = path.join(carpeta, `facturas-${marca}.dump`);

  // Formato "custom": comprimido y restaurable con pg_restore.
  await ejecutar('pg_dump', ['--format=custom', '--no-owner', '--file', destino, url], {
    maxBuffer: 1024 * 1024 * 64,
  });

  const { size } = await stat(destino);
  console.log(`Respaldo creado: ${destino} (${(size / 1024 / 1024).toFixed(2)} MB)`);

  // Borra los respaldos mas viejos que el periodo de retencion.
  const limite = Date.now() - diasConservar * 86_400_000;
  let borrados = 0;
  for (const archivo of await readdir(carpeta)) {
    if (!archivo.startsWith('facturas-') || !archivo.endsWith('.dump')) continue;
    const ruta = path.join(carpeta, archivo);
    if ((await stat(ruta)).mtimeMs < limite) {
      await unlink(ruta);
      borrados++;
    }
  }
  if (borrados > 0) console.log(`Se eliminaron ${borrados} respaldo(s) con mas de ${diasConservar} dias.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
