import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { obtenerSesion } from '@/lib/session';

const MENSAJES: Record<string, string> = {
  no_autorizado:
    'Su cuenta no esta registrada como aprobador. Solicite a Contabilidad que la agregue.',
  credenciales: 'Correo o contrasena incorrectos.',
  bloqueado: 'Demasiados intentos fallidos. La cuenta quedo bloqueada temporalmente.',
  estado_invalido: 'La sesion de inicio expiro. Intente nuevamente.',
  sin_codigo: 'Microsoft no devolvio el codigo de autorizacion.',
  token: 'No fue posible validar la respuesta de Microsoft.',
  no_configurado: 'Falta configurar el inicio de sesion con Microsoft.',
  dominio: 'Solo se permiten cuentas corporativas de Cofinet.',
  sesion_expirada: 'Su sesion expiro. Vuelva a iniciar sesion.',
};

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; min?: string }>;
}) {
  if (await obtenerSesion()) redirect('/facturas');

  const { error, min } = await searchParams;

  let mensaje = error ? (MENSAJES[error] ?? 'No fue posible iniciar sesion.') : null;
  if (error === 'bloqueado' && min) {
    mensaje = `Demasiados intentos fallidos. Intente de nuevo en ${min} minuto(s).`;
  }

  const local = env.localAuthEnabled;
  const entra = env.entraAuthEnabled;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-marca-800 via-marca-700 to-marca-900 px-4 py-10">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <p className="text-2xl font-bold tracking-[0.2em] text-marca-700">COFINET</p>
          <h1 className="mt-2 text-lg font-semibold text-marca-800">Aprobacion de facturas</h1>
          <p className="mt-1 text-sm text-pizarra-500">
            Facturas electronicas DIAN y cuentas de cobro
          </p>
        </div>

        {mensaje && (
          <p className="mb-5 aviso-error">
            {mensaje}
          </p>
        )}

        {local && (
          <form action="/api/auth/local" method="post" className="space-y-4">
            <div>
              <label className="etiqueta" htmlFor="correo">
                Correo corporativo
              </label>
              <input
                id="correo"
                name="correo"
                type="email"
                required
                autoComplete="username"
                placeholder="nombre@cofinet.com.au"
                className="campo"
              />
            </div>

            <div>
              <label className="etiqueta" htmlFor="clave">
                Contrasena
              </label>
              <input
                id="clave"
                name="clave"
                type="password"
                required
                autoComplete="current-password"
                className="campo"
              />
            </div>

            <button type="submit" className="btn-primary w-full py-2.5">
              Entrar
            </button>
          </form>
        )}

        {local && entra && (
          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-pizarra-200" />
            <span className="text-xs uppercase tracking-wide text-pizarra-500">o</span>
            <span className="h-px flex-1 bg-pizarra-200" />
          </div>
        )}

        {entra && (
          <a href="/api/auth/login" className={`btn-primary w-full py-2.5 ${local ? '' : 'mt-2'}`}>
            Iniciar sesion con Microsoft 365
          </a>
        )}

        {!local && !entra && (
          <p className="aviso-info">
            No hay ningun metodo de inicio de sesion configurado. Defina AUTH_MODE=local, o
            configure MS_TENANT_ID, MS_CLIENT_ID y MS_CLIENT_SECRET.
          </p>
        )}

        {env.devAuthEnabled && (
          <form
            action="/api/auth/dev"
            method="post"
            className="mt-6 border-t border-pizarra-200 pt-6"
          >
            <label className="etiqueta" htmlFor="correo-dev">
              Acceso de desarrollo
            </label>
            <div className="flex gap-2">
              <input
                id="correo-dev"
                name="correo"
                type="email"
                required
                placeholder="correo@cofinet.com.au"
                className="campo"
              />
              <button type="submit" className="btn-secundario whitespace-nowrap">
                Entrar
              </button>
            </div>
            <p className="mt-2 text-xs text-pizarra-500">
              Solo disponible con DEV_AUTH=true fuera de produccion.
            </p>
          </form>
        )}

        <p className="mt-8 text-center text-xs text-pizarra-400">
          Si olvido su contrasena, solicite a Sistemas que la restablezca.
        </p>
      </div>
    </main>
  );
}
