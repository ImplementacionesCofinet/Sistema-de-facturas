import { requireUser } from '@/lib/auth';
import { FormularioCambiarClave } from '@/components/FormularioClave';

export const dynamic = 'force-dynamic';

export default async function PaginaCambiarClave() {
  const user = await requireUser();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <p className="text-center text-xl font-bold tracking-tight text-cofinet-700">COFINET</p>
        <h1 className="mt-2 text-center text-lg font-semibold text-slate-800">
          Cambiar contrasena
        </h1>
        <p className="mb-6 mt-1 text-center text-sm text-slate-500">{user.correo}</p>

        <FormularioCambiarClave obligatorio={user.debeCambiarClave === true} />

        {!user.debeCambiarClave && (
          <p className="mt-6 text-center text-sm">
            <a href="/facturas" className="text-cofinet-700 hover:underline">
              Volver a facturas
            </a>
          </p>
        )}
      </div>
    </main>
  );
}
