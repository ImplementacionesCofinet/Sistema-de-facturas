import 'server-only';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from './env';

/**
 * Microsoft Entra ID (Azure AD) - Authorization Code Flow con PKCE.
 * Se usa el endpoint del tenant de Cofinet, de modo que solo pueden entrar
 * cuentas corporativas de cofinetcomco.onmicrosoft.com.
 */

function base64url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Buffer.from(bytes).toString('base64url');
}

export function generarVerificadorPkce(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function retoDesdeVerificador(verificador: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador));
  return base64url(digest);
}

export function generarState(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(16)));
}

export function redirectUri(): string {
  return `${env.appUrl}/api/auth/callback`;
}

export function urlAutorizacion(state: string, codeChallenge: string): string {
  const url = new URL(
    `https://login.microsoftonline.com/${env.msTenantId}/oauth2/v2.0/authorize`,
  );
  url.searchParams.set('client_id', env.msClientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri());
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('scope', 'openid profile email offline_access User.Read');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

interface RespuestaToken {
  id_token?: string;
  access_token?: string;
  error?: string;
  error_description?: string;
}

export async function intercambiarCodigo(
  code: string,
  codeVerifier: string,
): Promise<RespuestaToken> {
  const respuesta = await fetch(
    `https://login.microsoftonline.com/${env.msTenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.msClientId,
        client_secret: env.msClientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri(),
        code_verifier: codeVerifier,
      }),
    },
  );
  return (await respuesta.json()) as RespuestaToken;
}

const globalForJwks = globalThis as unknown as {
  __cofinetJwks?: ReturnType<typeof createRemoteJWKSet>;
};

function jwks() {
  if (!globalForJwks.__cofinetJwks) {
    globalForJwks.__cofinetJwks = createRemoteJWKSet(
      new URL(`https://login.microsoftonline.com/${env.msTenantId}/discovery/v2.0/keys`),
    );
  }
  return globalForJwks.__cofinetJwks;
}

export interface IdentidadMicrosoft {
  correo: string;
  nombre: string;
}

/** Valida la firma del id_token contra las llaves publicas del tenant. */
export async function verificarIdToken(idToken: string): Promise<IdentidadMicrosoft> {
  const { payload } = await jwtVerify(idToken, jwks(), {
    issuer: `https://login.microsoftonline.com/${env.msTenantId}/v2.0`,
    audience: env.msClientId,
  });

  const correo =
    (payload.email as string | undefined) ||
    (payload.preferred_username as string | undefined) ||
    (payload.upn as string | undefined);

  if (!correo) {
    throw new Error('El token de Microsoft no incluye correo electronico.');
  }

  return { correo, nombre: (payload.name as string | undefined) || correo };
}
