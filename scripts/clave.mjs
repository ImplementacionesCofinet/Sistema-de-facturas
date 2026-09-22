import { Client } from 'pg';
import { cargarEnv } from './env-file.mjs';
import { generarClaveTemporal, hashClave, validarClave } from '../src/lib/password.mjs';

cargarEnv();

/**
 * Crea o restablece la contrasena local de una persona.
 *
 *   node scripts/clave.mjs correo@cofinet.com.au             genera una temporal
 *   node scripts/clave.mjs correo@cofinet.com.au MiClave2026 usa la indicada
 *
 * Sirve para dos cosas:
 *  - el primer ingreso, cuando la tabla de credenciales todavia esta vacia;
 *  - recuperar el acceso cuando alguien olvido su contrasena y no hay ningun
 *    administrador que pueda entrar a restablecerla desde la app.
 *
 * La persona debe existir en la tabla aprobadores (o estar en ADMIN_EMAILS)
 * para que la app la deje pasar despues de autenticarse.
 */
async function main() {
  const correo = (process.argv[2] || '').trim().toLowerCase();
  const claveIndicada = process.argv[3];

  if (!correo) {
    console.error('Uso: node scripts/clave.mjs <correo> [clave]');
    process.exit(1);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    console.error(`El correo "${correo}" no es valido.`);
    process.exit(1);
  }

  const clave = claveIndicada || generarClaveTemporal();
  const problema = validarClave(clave);
  if (problema) {
    console.error(problema);
    process.exit(1);
  }

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

  const autorizado = await client.query(
    `SELECT 1 FROM aprobadores WHERE lower(correo) = $1 AND activo = TRUE LIMIT 1`,
    [correo],
  );
  const enAdminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .includes(correo);

  if (autorizado.rowCount === 0 && !enAdminEmails) {
    console.warn(
      `Aviso: ${correo} no figura en la tabla aprobadores ni en ADMIN_EMAILS.\n` +
        'La contrasena queda creada, pero la app no lo dejara entrar hasta que se le ' +
        'asigne un area y un rol.',
    );
  }

  // Se pide cambiarla al entrar solo cuando la genero el script.
  const debeCambiar = !claveIndicada;

  await client.query(
    `INSERT INTO credenciales (correo, clave_hash, debe_cambiar_clave, actualizado_en)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (correo) DO UPDATE
        SET clave_hash = EXCLUDED.clave_hash,
            debe_cambiar_clave = EXCLUDED.debe_cambiar_clave,
            intentos_fallidos = 0,
            bloqueado_hasta = NULL,
            actualizado_en = now()`,
    [correo, await hashClave(clave), debeCambiar],
  );

  await client.end();

  console.log(`\nContrasena establecida para ${correo}`);
  if (!claveIndicada) {
    console.log(`Clave temporal: ${clave}`);
    console.log('La app le pedira cambiarla la primera vez que entre.\n');
  } else {
    console.log('Se uso la clave indicada en la linea de comandos.\n');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
