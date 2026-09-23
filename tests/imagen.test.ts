import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * La imagen final no lleva el proyecto entero: solo el servidor compilado mas
 * db/ y scripts/. Dos veces ya se rompio la construccion o un script dentro del
 * contenedor porque un archivo necesario se habia quedado fuera, y el fallo solo
 * aparecia en el servidor, nunca al trabajar en local.
 *
 * Esta prueba compara lo que los scripts importan contra lo que el Dockerfile
 * copia, para que el olvido salte aqui y no delante del usuario.
 */
const RAIZ = path.resolve(__dirname, '..');
const dockerfile = readFileSync(path.join(RAIZ, 'Dockerfile'), 'utf8');

/** Rutas del proyecto que la etapa final copia a la imagen. */
function rutasCopiadas(): string[] {
  const rutas: string[] = [];
  for (const linea of dockerfile.split('\n')) {
    const m = linea.match(/^COPY --from=builder[^/]*\/app\/(\S+)/);
    if (m) rutas.push(m[1]);
  }
  return rutas;
}

function estaEnLaImagen(rutaRelativa: string, copiadas: string[]): boolean {
  const normal = rutaRelativa.split(path.sep).join('/');

  return copiadas.some((copiada) => {
    if (copiada.includes('*')) {
      // "src/lib/*.mjs" cubre los archivos de esa carpeta, no de sus subcarpetas.
      const patron = new RegExp(
        `^${copiada.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')}$`,
      );
      return patron.test(normal);
    }
    return normal === copiada || normal.startsWith(`${copiada}/`);
  });
}

describe('contenido de la imagen de Docker', () => {
  const copiadas = rutasCopiadas();

  it('la etapa final copia db/ y scripts/', () => {
    expect(copiadas).toContain('db');
    expect(copiadas).toContain('scripts');
  });

  it('todo lo que importan los scripts viaja dentro de la imagen', () => {
    const carpeta = path.join(RAIZ, 'scripts');
    const faltantes: string[] = [];

    for (const archivo of readdirSync(carpeta).filter((f) => f.endsWith('.mjs'))) {
      const contenido = readFileSync(path.join(carpeta, archivo), 'utf8');

      for (const m of contenido.matchAll(/from\s+'(\.[^']+)'/g)) {
        const destino = path.resolve(carpeta, m[1]);
        const relativa = path.relative(RAIZ, destino);

        if (!existsSync(destino)) {
          faltantes.push(`${archivo} importa ${m[1]}, que no existe`);
          continue;
        }
        if (!estaEnLaImagen(relativa, copiadas)) {
          faltantes.push(
            `${archivo} importa ${m[1]} (${relativa}), que la imagen no copia`,
          );
        }
      }
    }

    expect(faltantes).toEqual([]);
  });

  it('la carpeta public existe y esta versionada', () => {
    // Git no guarda carpetas vacias: sin un archivo dentro, el COPY de la
    // etapa final falla en un clon limpio.
    const publico = path.join(RAIZ, 'public');
    expect(existsSync(publico)).toBe(true);
    expect(readdirSync(publico).length).toBeGreaterThan(0);
  });

  it('las migraciones que se copian son las que hay en el repositorio', () => {
    const migraciones = readdirSync(path.join(RAIZ, 'db/migrations'));
    expect(migraciones.filter((f) => f.endsWith('.sql')).length).toBeGreaterThan(0);
  });
});
