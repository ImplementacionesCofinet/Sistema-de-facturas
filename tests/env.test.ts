import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { env } from '@/lib/env';

/**
 * El modo de autenticacion decide que se ofrece en la pantalla de entrada.
 * Equivocarse aqui deja a la gente sin poder entrar, o expone una via que se
 * creia apagada, asi que conviene tenerlo cubierto.
 */
describe('env.authMode', () => {
  const original = { ...process.env };

  beforeEach(() => {
    delete process.env.AUTH_MODE;
    delete process.env.MS_TENANT_ID;
    delete process.env.MS_CLIENT_ID;
    delete process.env.MS_CLIENT_SECRET;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  const configurarMicrosoft = () => {
    process.env.MS_TENANT_ID = 'tenant';
    process.env.MS_CLIENT_ID = 'cliente';
    process.env.MS_CLIENT_SECRET = 'secreto';
  };

  it('sin configurar nada, usa contrasena local', () => {
    expect(env.authMode).toBe('local');
    expect(env.localAuthEnabled).toBe(true);
    expect(env.entraAuthEnabled).toBe(false);
  });

  it('con credenciales de Microsoft, usa Microsoft', () => {
    configurarMicrosoft();
    expect(env.authMode).toBe('entra');
    expect(env.entraAuthEnabled).toBe(true);
    expect(env.localAuthEnabled).toBe(false);
  });

  it('AUTH_MODE manda sobre lo anterior', () => {
    configurarMicrosoft();
    process.env.AUTH_MODE = 'local';
    expect(env.authMode).toBe('local');
    expect(env.entraAuthEnabled).toBe(false);
  });

  it('el modo "ambos" habilita las dos vias', () => {
    configurarMicrosoft();
    process.env.AUTH_MODE = 'ambos';
    expect(env.localAuthEnabled).toBe(true);
    expect(env.entraAuthEnabled).toBe(true);
  });

  it('no ofrece Microsoft si faltan sus credenciales, aunque se pida', () => {
    process.env.AUTH_MODE = 'entra';
    expect(env.entraAuthEnabled).toBe(false);
  });

  it('ignora un valor desconocido y cae en el comportamiento por defecto', () => {
    process.env.AUTH_MODE = 'cualquier-cosa';
    expect(env.authMode).toBe('local');
  });
});

describe('env.devAuthEnabled', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it('nunca se activa en produccion', () => {
    process.env.DEV_AUTH = 'true';
    // NODE_ENV esta tipado como solo lectura; en la prueba se fuerza.
    Object.assign(process.env, { NODE_ENV: 'production' });
    expect(env.devAuthEnabled).toBe(false);
  });

  it('se activa fuera de produccion cuando se pide', () => {
    process.env.DEV_AUTH = 'true';
    Object.assign(process.env, { NODE_ENV: 'development' });
    expect(env.devAuthEnabled).toBe(true);
  });
});
