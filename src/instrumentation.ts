/**
 * Se ejecuta una sola vez al arrancar el servidor.
 *
 * Aplica las migraciones pendientes para que actualizar la aplicacion sea
 * simplemente traer la version nueva y reconstruir. Olvidar el paso manual
 * dejaba la app con una base desactualizada y todas las paginas fallaban con
 * un error que no explicaba nada.
 *
 * Se puede desactivar con MIGRAR_AL_ARRANCAR=false, por si en algun despliegue
 * se prefiere ejecutarlas aparte.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.MIGRAR_AL_ARRANCAR === 'false') return;

  try {
    const { getPool } = await import('./lib/db');
    const { aplicarMigraciones } = await import('./lib/migraciones.mjs');

    const cliente = await getPool().connect();
    try {
      const { aplicadas } = await aplicarMigraciones(cliente, {
        registrar: (mensaje: string) => console.log(`[migraciones] ${mensaje}`),
      });
      if (aplicadas.length > 0) {
        console.log(`[migraciones] ${aplicadas.length} migracion(es) aplicada(s).`);
      }
    } finally {
      cliente.release();
    }
  } catch (error) {
    // No se detiene el arranque: asi el servidor responde y el motivo queda
    // visible en el registro, en vez de morir sin dejar rastro.
    console.error(
      '[migraciones] No fue posible aplicar las migraciones al arrancar:',
      error instanceof Error ? error.message : error,
    );
  }
}
