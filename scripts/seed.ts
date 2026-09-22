import { Client } from 'pg';
import { cargarEnv } from './env-file';

cargarEnv();

/**
 * Carga inicial del catalogo de areas y de los jefes de area.
 * Es idempotente: se puede volver a ejecutar sin duplicar filas.
 * Ajuste esta lista con las areas y correos reales de Cofinet.
 */
const AREAS = [
  'ADMINISTRACION',
  'COMERCIAL',
  'CONTABILIDAD',
  'GERENCIA',
  'LOGISTICA',
  'OPERACIONES',
  'SISTEMAS',
  'TRILLA',
];

interface SemillaAprobador {
  area: string;
  nombre: string;
  correo: string;
  rol: 'APROBADOR' | 'CONTABILIDAD' | 'ADMIN';
}

const APROBADORES: SemillaAprobador[] = [
  { area: 'CONTABILIDAD', nombre: 'Contabilidad Cofinet', correo: 'contabilidad@cofinet.com.au', rol: 'CONTABILIDAD' },
  { area: 'ADMINISTRACION', nombre: 'Jefe de Administracion', correo: 'administracion@cofinet.com.au', rol: 'APROBADOR' },
  { area: 'COMERCIAL', nombre: 'Jefe Comercial', correo: 'comercial@cofinet.com.au', rol: 'APROBADOR' },
  { area: 'LOGISTICA', nombre: 'Jefe de Logistica', correo: 'logistica@cofinet.com.au', rol: 'APROBADOR' },
  { area: 'OPERACIONES', nombre: 'Jefe de Operaciones', correo: 'operaciones@cofinet.com.au', rol: 'APROBADOR' },
  { area: 'SISTEMAS', nombre: 'Jefe de Sistemas', correo: 'sistemas@cofinet.com.au', rol: 'APROBADOR' },
  { area: 'TRILLA', nombre: 'Jefe de Trilla', correo: 'trilla@cofinet.com.au', rol: 'APROBADOR' },
];

async function main(): Promise<void> {
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

  for (const area of AREAS) {
    await client.query(
      `INSERT INTO areas (nombre) VALUES ($1)
       ON CONFLICT (upper(nombre)) DO NOTHING`,
      [area],
    );
  }

  for (const a of APROBADORES) {
    await client.query(
      `INSERT INTO aprobadores (area, nombre, correo, rol) VALUES ($1, $2, $3, $4)
       ON CONFLICT (lower(correo), upper(area))
       DO UPDATE SET nombre = EXCLUDED.nombre, rol = EXCLUDED.rol, activo = TRUE`,
      [a.area, a.nombre, a.correo, a.rol],
    );
  }

  // Los correos de ADMIN_EMAILS quedan como administradores desde el arranque.
  const admins = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  for (const correo of admins) {
    await client.query(
      `INSERT INTO aprobadores (area, nombre, correo, rol) VALUES ('CONTABILIDAD', $1, $1, 'ADMIN')
       ON CONFLICT (lower(correo), upper(area))
       DO UPDATE SET rol = 'ADMIN', activo = TRUE`,
      [correo],
    );
  }

  await client.end();
  console.log(
    `Semilla lista: ${AREAS.length} areas, ${APROBADORES.length} aprobadores, ${admins.length} administradores.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
