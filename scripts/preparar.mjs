import { randomBytes } from 'node:crypto';
import { access, writeFile } from 'node:fs/promises';

/**
 * Deja listo el archivo .env para trabajar en el computador propio.
 *
 *   npm run preparar                              usa valores por defecto
 *   npm run preparar -- correo@cofinet.com.au     ademas lo deja como ADMIN
 *
 * No toca un .env que ya exista: si quiere empezar de cero, borrelo antes.
 */
const ARCHIVO = '.env';

const correoAdmin = (process.argv[2] || '').trim().toLowerCase();

const PLANTILLA = (secreto, admin) => `# Archivo generado por "npm run preparar".
# Configuracion para trabajar en este computador. No lo suba al repositorio.

# PostgreSQL local. Ajuste usuario, clave y nombre de la base si su
# instalacion usa otros valores.
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cofinet_facturas

# Direccion en la que abrira la app en el navegador.
APP_URL=http://localhost:3000

# Firma la cookie de sesion. Generado al azar para esta instalacion.
SESSION_SECRET=${secreto}

# Entrar con correo y contrasena guardados en la base (sin Microsoft).
AUTH_MODE=local

# Este correo entra como administrador aunque la tabla aprobadores este vacia.
ADMIN_EMAILS=${admin}

# Los documentos soporte se guardan en la carpeta ./storage
STORAGE_DRIVER=local
STORAGE_LOCAL_DIR=./storage
`;

async function existe(ruta) {
  try {
    await access(ruta);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (await existe(ARCHIVO)) {
    console.log(
      `Ya existe un archivo ${ARCHIVO}; no se modifico.\n` +
        'Si quiere regenerarlo, borrelo y vuelva a ejecutar este comando.',
    );
    return;
  }

  if (correoAdmin && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoAdmin)) {
    console.error(`El correo "${correoAdmin}" no es valido.`);
    process.exit(1);
  }

  const secreto = randomBytes(48).toString('base64url');
  await writeFile(ARCHIVO, PLANTILLA(secreto, correoAdmin), 'utf8');

  console.log(`Archivo ${ARCHIVO} creado.\n`);
  console.log('Revise que DATABASE_URL coincida con su PostgreSQL y siga con:\n');
  console.log('  npm run db:migrate');
  console.log('  npm run db:seed');
  console.log(
    `  npm run clave ${correoAdmin || '<su-correo@cofinet.com.au>'}`,
  );
  console.log('  npm run dev\n');
  console.log('Luego abra http://localhost:3000 en el navegador.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
