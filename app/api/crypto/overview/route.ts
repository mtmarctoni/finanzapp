import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { computePortfolio } from '@/lib/crypto/portfolio';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const overview = await computePortfolio(session.user.id);

    return NextResponse.json(overview);
  } catch (error) {
    console.error('Error fetching crypto overview:', error);
    return NextResponse.json(
      { error: 'Failed to fetch crypto overview' },
      { status: 500 },
    );
  }
}
