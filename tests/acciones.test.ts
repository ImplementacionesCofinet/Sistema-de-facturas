import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Next exige que un archivo marcado con 'use server' exporte unicamente
 * funciones asincronas. Exportar ademas una constante compilaba sin quejarse y
 * pasaba las pruebas, pero rompia la pagina en produccion con
 * "A 'use server' file can only export async functions, found object",
 * dejando al usuario ante una pantalla de error sin mas explicacion.
 */
const CARPETA = path.resolve(__dirname, '../src/app/actions');

function archivosDeAcciones(): string[] {
  return readdirSync(CARPETA).filter((f) => f.endsWith('.ts'));
}

describe("archivos 'use server'", () => {
  const archivos = archivosDeAcciones();

  it('hay archivos de acciones que revisar', () => {
    expect(archivos.length).toBeGreaterThan(0);
  });

  it.each(archivos)('%s solo exporta funciones asincronas', (archivo) => {
    const contenido = readFileSync(path.join(CARPETA, archivo), 'utf8');

    // Solo aplica a los archivos que realmente declaran 'use server'.
    if (!/^\s*['"]use server['"]/m.test(contenido)) return;

    const prohibidos: string[] = [];

    for (const linea of contenido.split('\n')) {
      const exportacion = linea.match(/^export\s+(.+)/);
      if (!exportacion) continue;

      const resto = exportacion[1];

      // Los tipos desaparecen al compilar: no llegan a ejecucion.
      if (/^(type|interface)\s/.test(resto)) continue;
      // Unica forma valida en tiempo de ejecucion.
      if (/^async\s+function\s/.test(resto)) continue;

      prohibidos.push(linea.trim());
    }

    expect(prohibidos, `${archivo} exporta algo que no es una funcion asincrona`).toEqual([]);
  });
});
