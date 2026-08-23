import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getPricesForSymbols } from '@/lib/crypto/prices';

const MAX_SYMBOLS = 20;

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const symbolsParam = request.nextUrl.searchParams.get('symbols') ?? '';
  const symbols = symbolsParam
    .split(',')
    .map((symbol) => symbol.trim())
    .filter(Boolean)
    .slice(0, MAX_SYMBOLS);

  if (symbols.length === 0) {
    return NextResponse.json({ prices: [] });
  }

  try {
    const prices = await getPricesForSymbols(symbols);
    return NextResponse.json({ prices });
  } catch (error) {
    console.error('Error fetching crypto prices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch crypto prices' },
      { status: 500 },
    );
  }
}
