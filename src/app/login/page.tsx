import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { obtenerSesion } from '@/lib/session';

const MENSAJES: Record<string, string> = {
  no_autorizado:
    'Su cuenta no esta registrada como aprobador. Solicite a Contabilidad que la agregue.',
  estado_invalido: 'La sesion de inicio expiro. Intente nuevamente.',
  sin_codigo: 'Microsoft no devolvio el codigo de autorizacion.',
  token: 'No fue posible validar la respuesta de Microsoft.',
  dominio: 'Solo se permiten cuentas corporativas de Cofinet.',
  sesion_expirada: 'Su sesion expiro. Vuelva a iniciar sesion.',
};

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await obtenerSesion()) redirect('/facturas');

  const { error } = await searchParams;
  const mensaje = error ? (MENSAJES[error] ?? 'No fue posible iniciar sesion.') : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cofinet-800 via-cofinet-700 to-cofinet-900 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <p className="text-2xl font-bold tracking-tight text-cofinet-700">COFINET</p>
          <h1 className="mt-2 text-lg font-semibold text-slate-800">
            Aprobacion de facturas
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Facturas electronicas DIAN y cuentas de cobro
          </p>
        </div>

        {mensaje && (
          <p className="mb-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {mensaje}
          </p>
        )}

        {env.msConfigured ? (
          <a href="/api/auth/login" className="btn-primary w-full py-2.5">
            Iniciar sesion con Microsoft 365
          </a>
        ) : (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Falta configurar las credenciales de Microsoft Entra ID
            (MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET).
          </p>
        )}

        {env.devAuthEnabled && (
          <form action="/api/auth/dev" method="post" className="mt-6 border-t border-slate-200 pt-6">
            <label className="etiqueta" htmlFor="correo">
              Acceso de desarrollo
            </label>
            <div className="flex gap-2">
              <input
                id="correo"
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
            <p className="mt-2 text-xs text-slate-500">
              Solo disponible con DEV_AUTH=true fuera de produccion.
            </p>
          </form>
        )}

        <p className="mt-8 text-center text-xs text-slate-400">
          Cuenta corporativa del tenant cofinetcomco.onmicrosoft.com
        </p>
      </div>
    </main>
  );
}
