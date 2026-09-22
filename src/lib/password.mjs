import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

/**
 * Hash de contrasenas con scrypt, que viene en Node y no necesita dependencias
 * nativas (importante para instalar en un servidor de la empresa sin compilador).
 *
 * Formato almacenado:  scrypt$<N>$<r>$<p>$<salt_b64>$<hash_b64>
 */
const N = 16384;
const R = 8;
const P = 1;
const LONGITUD = 64;

export const LONGITUD_MINIMA_CLAVE = 10;

/**
 * @param {string} clave
 * @returns {Promise<string>}
 */
export async function hashClave(clave) {
  const salt = randomBytes(16);
  const derivada = await scryptAsync(clave.normalize('NFKC'), salt, LONGITUD, {
    N,
    r: R,
    p: P,
    maxmem: 64 * 1024 * 1024,
  });

  return [
    'scrypt',
    N,
    R,
    P,
    salt.toString('base64'),
    derivada.toString('base64'),
  ].join('$');
}

/**
 * @param {string} clave
 * @param {string} almacenado
 * @returns {Promise<boolean>}
 */
export async function verificarClave(clave, almacenado) {
  const partes = almacenado.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;

  const [, n, r, p, saltB64, hashB64] = partes;
  const salt = Buffer.from(saltB64, 'base64');
  const esperado = Buffer.from(hashB64, 'base64');

  /** @type {Buffer} */
  let derivada;
  try {
    derivada = await scryptAsync(clave.normalize('NFKC'), salt, esperado.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    });
  } catch {
    return false;
  }

  if (derivada.length !== esperado.length) return false;
  return timingSafeEqual(derivada, esperado);
}

/**
 * Reglas minimas de la contrasena. Devuelve el problema, o null si esta bien.
 * @param {string} clave
 * @returns {string | null}
 */
export function validarClave(clave) {
  if (clave.length < LONGITUD_MINIMA_CLAVE) {
    return `La contrasena debe tener al menos ${LONGITUD_MINIMA_CLAVE} caracteres.`;
  }
  if (!/[a-zA-Z]/.test(clave) || !/[0-9]/.test(clave)) {
    return 'La contrasena debe combinar letras y numeros.';
  }
  return null;
}

/**
 * Clave inicial legible para entregar a un usuario nuevo.
 * @returns {string}
 */
export function generarClaveTemporal() {
  const letras = 'abcdefghijkmnpqrstuvwxyz';
  const numeros = '23456789';
  const bytes = randomBytes(12);
  let clave = '';
  for (let i = 0; i < 8; i++) {
    clave += letras[bytes[i] % letras.length];
  }
  for (let i = 8; i < 12; i++) {
    clave += numeros[bytes[i] % numeros.length];
  }
  return clave;
}
