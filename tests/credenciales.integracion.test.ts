import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Pruebas contra una base de datos real.
 *
 * Se ejecutan solo si hay DATABASE_URL apuntando a una base de pruebas con las
 * migraciones aplicadas:
 *
 *   DATABASE_URL=postgresql://... npm test
 *
 * Sin esa variable se omiten, para que `npm test` siga sirviendo en un equipo
 * que no tenga PostgreSQL instalado.
 */
const hayBaseDeDatos = Boolean(process.env.DATABASE_URL);
const describeSiHayBase = hayBaseDeDatos ? describe : describe.skip;

const CORREO = 'prueba.integracion@cofinet.com.au';

describeSiHayBase('credenciales locales (integracion)', () => {
  let credenciales: typeof import('@/lib/credenciales');
  let db: typeof import('@/lib/db');

  beforeAll(async () => {
    credenciales = await import('@/lib/credenciales');
    db = await import('@/lib/db');

    await db.query('DELETE FROM credenciales WHERE correo = $1', [CORREO]);
    await db.query('DELETE FROM aprobadores WHERE lower(correo) = $1', [CORREO]);
    await db.query(
      `INSERT INTO aprobadores (area, nombre, correo, rol) VALUES ('LOGISTICA', $1, $2, 'APROBADOR')`,
      ['Prueba Integracion', CORREO],
    );
  });

  afterAll(async () => {
    if (!db) return;
    await db.query('DELETE FROM credenciales WHERE correo = $1', [CORREO]);
    await db.query('DELETE FROM aprobadores WHERE lower(correo) = $1', [CORREO]);
    await db.getPool().end();
  });

  it('rechaza a quien no tiene contrasena registrada', async () => {
    const r = await credenciales.autenticarLocal(CORREO, 'loquesea123');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe('credenciales');
  });

  it('autentica con la contrasena correcta y trae rol y areas', async () => {
    await credenciales.establecerClave(CORREO, 'Temporal2026', { debeCambiar: true });

    const r = await credenciales.autenticarLocal(CORREO, 'Temporal2026');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.usuario.correo).toBe(CORREO);
      expect(r.usuario.rol).toBe('APROBADOR');
      expect(r.usuario.areas).toEqual(['LOGISTICA']);
      // Clave temporal: la app debe obligar a cambiarla.
      expect(r.usuario.debeCambiarClave).toBe(true);
    }
  });

  it('rechaza la contrasena equivocada', async () => {
    const r = await credenciales.autenticarLocal(CORREO, 'Equivocada2026');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe('credenciales');
  });

  it('no deja cambiar la contrasena sin saber la actual', async () => {
    const r = await credenciales.cambiarClavePropia(CORREO, 'Equivocada2026', 'Nueva2026Clave');
    expect(r.ok).toBe(false);
    expect(r.mensaje).toMatch(/actual no es correcta/i);
  });

  it('exige que la contrasena nueva sea distinta', async () => {
    const r = await credenciales.cambiarClavePropia(CORREO, 'Temporal2026', 'Temporal2026');
    expect(r.ok).toBe(false);
    expect(r.mensaje).toMatch(/distinta/i);
  });

  it('exige una contrasena nueva con longitud y complejidad minimas', async () => {
    const corta = await credenciales.cambiarClavePropia(CORREO, 'Temporal2026', 'corta1');
    expect(corta.ok).toBe(false);
    expect(corta.mensaje).toMatch(/10 caracteres/);

    const simple = await credenciales.cambiarClavePropia(CORREO, 'Temporal2026', 'solamenteletras');
    expect(simple.ok).toBe(false);
    expect(simple.mensaje).toMatch(/letras y numeros/);
  });

  it('cambia la contrasena y quita la marca de clave temporal', async () => {
    const r = await credenciales.cambiarClavePropia(CORREO, 'Temporal2026', 'Definitiva2026');
    expect(r.ok).toBe(true);

    const vieja = await credenciales.autenticarLocal(CORREO, 'Temporal2026');
    expect(vieja.ok).toBe(false);

    const nueva = await credenciales.autenticarLocal(CORREO, 'Definitiva2026');
    expect(nueva.ok).toBe(true);
    if (nueva.ok) expect(nueva.usuario.debeCambiarClave).toBe(false);
  });

  it('bloquea la cuenta tras varios intentos fallidos seguidos', async () => {
    const maximo = Number(process.env.MAX_INTENTOS_LOGIN || 5);

    let ultimo;
    for (let i = 0; i < maximo; i++) {
      ultimo = await credenciales.autenticarLocal(CORREO, `fallido${i}999`);
    }

    expect(ultimo?.ok).toBe(false);
    if (ultimo && !ultimo.ok) expect(ultimo.motivo).toBe('bloqueado');

    // Estando bloqueada, ni siquiera la contrasena correcta debe pasar.
    const correcta = await credenciales.autenticarLocal(CORREO, 'Definitiva2026');
    expect(correcta.ok).toBe(false);
    if (!correcta.ok) expect(correcta.motivo).toBe('bloqueado');

    // Restablecer la clave desbloquea la cuenta.
    await credenciales.establecerClave(CORREO, 'Definitiva2026', { debeCambiar: false });
    const tras = await credenciales.autenticarLocal(CORREO, 'Definitiva2026');
    expect(tras.ok).toBe(true);
  });

  it('niega la entrada a quien tiene clave pero no esta autorizado', async () => {
    await db.query('UPDATE aprobadores SET activo = FALSE WHERE lower(correo) = $1', [CORREO]);

    const r = await credenciales.autenticarLocal(CORREO, 'Definitiva2026');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe('no_autorizado');

    await db.query('UPDATE aprobadores SET activo = TRUE WHERE lower(correo) = $1', [CORREO]);
  });
});
