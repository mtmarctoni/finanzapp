import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { ITEMS_PER_PAGE } from '@/config';
import { getEntries } from '@/lib/actions';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') ?? '';
  const accion = searchParams.get('accion') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty param must fall back to '1'; '' would make parseInt yield NaN
  const page = parseInt(searchParams.get('page') || '1');
  const itemsPerPage = parseInt(
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty param must fall back to default; '' would make parseInt yield NaN
    searchParams.get('itemsPerPage') || ITEMS_PER_PAGE.toString(),
  );
  const sortBy = searchParams.get('sortBy') ?? '';
  const sortOrder = searchParams.get('sortOrder') ?? '';

  const session = await getServerSession(authOptions);

  if (!session?.user.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const filters = {
      search,
      accion,
      from,
      to,
      page,
      itemsPerPage,
      sortBy,
      sortOrder,
    };

    const result = await getEntries(filters, { user: { id: session.user.id } });
    // console.log('result', result)
    return NextResponse.json({
      data: result.entries,
      totalItems: result.total,
      totalPages: result.totalPages,
      currentPage: page,
    });
  } catch (error) {
    console.error('Error fetching entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch entries' },
      { status: 500 },
    );
  }
}
