import { Client } from 'pg';
import { cargarEnv } from './env-file.mjs';
import { aplicarMigraciones } from '../src/lib/migraciones.mjs';

cargarEnv();

/**
 * Aplica las migraciones pendientes desde la linea de comandos.
 * La aplicacion tambien las aplica sola al arrancar; este comando sirve para
 * hacerlo aparte, por ejemplo antes de levantar el servicio.
 */
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

  const { aplicadas, yaEstaban } = await aplicarMigraciones(client, {
    registrar: (mensaje) => console.log(mensaje),
  });

  for (const nombre of yaEstaban) console.log(`= ${nombre} (ya aplicada)`);
  await client.end();

  console.log(
    aplicadas.length > 0
      ? `Migraciones al dia: ${aplicadas.length} aplicada(s).`
      : 'Migraciones al dia: no habia pendientes.',
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
