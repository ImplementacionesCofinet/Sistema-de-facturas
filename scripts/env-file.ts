/** Carga .env antes de usar process.env en los scripts de linea de comandos. */
export function cargarEnv(): void {
  for (const archivo of ['.env.local', '.env']) {
    try {
      process.loadEnvFile(archivo);
    } catch {
      // El archivo no existe: se usan las variables ya presentes en el entorno.
    }
  }
}
