import { requireUser } from '@/lib/auth';
import { Nav } from '@/components/Nav';

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen">
      <Nav user={user} />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
