import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getEntryHints, getFormOptions } from '@/lib/server-data';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const [options, hints] = await Promise.all([
      getFormOptions(session),
      // Hints only make the quick-add sheet smarter; never fail the dropdowns.
      getEntryHints(session).catch((error: unknown) => {
        console.error('Error fetching entry hints:', error);
        return null;
      }),
    ]);
    return NextResponse.json({ ...options, hints });
  } catch (error) {
    console.error('Error fetching options:', error);
    return NextResponse.json(
      { error: 'Failed to fetch options' },
      { status: 500 },
    );
  }
}
