import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { duplicateCryptoTransaction } from '@/lib/cryptoActions';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session?.user.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const duplicated = await duplicateCryptoTransaction(id, {
      user: { id: session.user.id },
    });

    if (!duplicated) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 },
      );
    }

    return NextResponse.json(duplicated);
  } catch (error) {
    console.error('Error duplicating crypto transaction:', error);
    return NextResponse.json(
      { error: 'Failed to duplicate crypto transaction' },
      { status: 500 },
    );
  }
}
