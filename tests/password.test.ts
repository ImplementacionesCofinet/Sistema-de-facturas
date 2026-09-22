import { describe, expect, it } from 'vitest';
import {
  generarClaveTemporal,
  hashClave,
  validarClave,
  verificarClave,
} from '@/lib/password.mjs';

describe('hash de contrasenas', () => {
  it('verifica la contrasena correcta', async () => {
    const hash = await hashClave('Cofinet2026');
    expect(await verificarClave('Cofinet2026', hash)).toBe(true);
  });

  it('rechaza una contrasena incorrecta', async () => {
    const hash = await hashClave('Cofinet2026');
    expect(await verificarClave('cofinet2026', hash)).toBe(false);
    expect(await verificarClave('', hash)).toBe(false);
  });

  it('usa una sal distinta cada vez', async () => {
    const a = await hashClave('Cofinet2026');
    const b = await hashClave('Cofinet2026');
    expect(a).not.toBe(b);
    expect(await verificarClave('Cofinet2026', b)).toBe(true);
  });

  it('nunca guarda la contrasena en claro', async () => {
    const hash = await hashClave('Cofinet2026');
    expect(hash).not.toContain('Cofinet2026');
    expect(hash.startsWith('scrypt$')).toBe(true);
  });

  it('acepta tildes y enes normalizando el texto', async () => {
    const hash = await hashClave('contrasEña2026');
    expect(await verificarClave('contrasEña2026', hash)).toBe(true);
  });

  it('no falla con un hash corrupto o de otro formato', async () => {
    expect(await verificarClave('x', 'basura')).toBe(false);
    expect(await verificarClave('x', 'scrypt$1$2$3$4$5')).toBe(false);
  });
});

describe('validarClave', () => {
  it('exige longitud minima', () => {
    expect(validarClave('corta1')).toMatch(/10 caracteres/);
  });

  it('exige letras y numeros', () => {
    expect(validarClave('solamenteletras')).toMatch(/letras y numeros/);
    expect(validarClave('1234567890')).toMatch(/letras y numeros/);
  });

  it('acepta una contrasena valida', () => {
    expect(validarClave('Facturas2026')).toBeNull();
  });
});

describe('generarClaveTemporal', () => {
  it('genera claves validas y distintas', () => {
    const a = generarClaveTemporal();
    const b = generarClaveTemporal();
    expect(validarClave(a)).toBeNull();
    expect(a).not.toBe(b);
  });

  it('evita caracteres que se confunden al dictarlas', () => {
    for (let i = 0; i < 50; i++) {
      expect(generarClaveTemporal()).not.toMatch(/[loO0I1]/);
    }
  });
});
