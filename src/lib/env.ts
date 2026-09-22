/**
 * Configuracion por variables de entorno.
 * Ver .env.example para la lista completa y de donde sale cada valor.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `Falta la variable de entorno ${name}. Revise el archivo .env (ver .env.example).`,
    );
  }
  return value;
}

export const env = {
  get databaseUrl(): string {
    return required('DATABASE_URL', process.env.DATABASE_URL);
  },

  /** Secreto para firmar la cookie de sesion. Minimo 32 caracteres. */
  get sessionSecret(): string {
    return required('SESSION_SECRET', process.env.SESSION_SECRET);
  },

  /** URL publica de la app, usada para construir el redirect_uri de Microsoft. */
  get appUrl(): string {
    return (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  },

  // --- Microsoft Entra ID (Azure AD) -----------------------------------------
  get msTenantId(): string {
    return required('MS_TENANT_ID', process.env.MS_TENANT_ID);
  },
  get msClientId(): string {
    return required('MS_CLIENT_ID', process.env.MS_CLIENT_ID);
  },
  get msClientSecret(): string {
    return required('MS_CLIENT_SECRET', process.env.MS_CLIENT_SECRET);
  },

  /** true cuando hay credenciales de Microsoft configuradas. */
  get msConfigured(): boolean {
    return Boolean(
      process.env.MS_TENANT_ID && process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET,
    );
  },

  /**
   * Como inicia sesion la gente:
   *   'entra' -> solo Microsoft 365 (requiere HTTPS y salida a internet)
   *   'local' -> solo usuario y contrasena guardados en esta base de datos
   *   'ambos' -> se ofrecen las dos opciones
   * Por defecto: 'entra' si hay credenciales de Microsoft, 'local' si no.
   */
  get authMode(): 'entra' | 'local' | 'ambos' {
    const valor = (process.env.AUTH_MODE || '').trim().toLowerCase();
    if (valor === 'entra' || valor === 'local' || valor === 'ambos') return valor;
    return this.msConfigured ? 'entra' : 'local';
  },

  get localAuthEnabled(): boolean {
    return this.authMode === 'local' || this.authMode === 'ambos';
  },

  get entraAuthEnabled(): boolean {
    return (this.authMode === 'entra' || this.authMode === 'ambos') && this.msConfigured;
  },

  /** Intentos fallidos seguidos antes de bloquear temporalmente la cuenta. */
  get maxIntentosLogin(): number {
    return Number(process.env.MAX_INTENTOS_LOGIN || 5);
  },

  /** Minutos que dura el bloqueo por intentos fallidos. */
  get minutosBloqueoLogin(): number {
    return Number(process.env.MINUTOS_BLOQUEO_LOGIN || 15);
  },

  /**
   * Login local sin Microsoft, solo para desarrollo.
   * NUNCA debe quedar activo en produccion.
   */
  get devAuthEnabled(): boolean {
    return process.env.DEV_AUTH === 'true' && process.env.NODE_ENV !== 'production';
  },

  /**
   * Correos que siempre entran como ADMIN aunque no esten en la tabla
   * aprobadores. Sirve para el primer inicio de sesion.
   */
  get adminEmails(): string[] {
    return (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  },

  /** Dominios de correo autorizados. Vacio = cualquier cuenta del tenant. */
  get allowedDomains(): string[] {
    return (process.env.ALLOWED_EMAIL_DOMAINS || '')
      .split(',')
      .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
      .filter(Boolean);
  },

  // --- Almacenamiento de adjuntos --------------------------------------------
  get storageDriver(): 'local' | 'azure' {
    return process.env.STORAGE_DRIVER === 'azure' ? 'azure' : 'local';
  },
  get storageLocalDir(): string {
    return process.env.STORAGE_LOCAL_DIR || './storage';
  },
  get azureStorageConnectionString(): string | undefined {
    return process.env.AZURE_STORAGE_CONNECTION_STRING;
  },
  get azureStorageContainer(): string {
    return process.env.AZURE_STORAGE_CONTAINER || 'soportes-facturas';
  },
};
