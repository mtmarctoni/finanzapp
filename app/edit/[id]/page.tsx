import { FinanceForm } from '@/components/finance-form';
import { getEntryById } from '@/lib/server-data';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect, notFound } from 'next/navigation';

export default async function EditEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // SECURITY: this page used to load any entry by id without checking
  // ownership, so an authenticated user could browse to /edit/<other-id>
  // and view/edit another user's row. We now require a session and pass
  // it down to the server data layer, which scopes the lookup to the
  // current user's rows.
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const { id } = await params;
  const entry = await getEntryById(id, session);

  if (!entry) {
    notFound();
  }

  return (
    <main className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Editar Entrada</h1>
      <FinanceForm entry={entry} />
    </main>
  );
}
