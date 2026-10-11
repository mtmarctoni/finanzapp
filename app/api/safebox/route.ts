import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getSafeboxSummary } from '@/lib/safeboxActions';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const summary = await getSafeboxSummary({ user: { id: session.user.id } });
    return NextResponse.json(summary);
  } catch (error) {
    console.error('Error fetching safebox summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch safebox summary' },
      { status: 500 },
    );
  }
}
