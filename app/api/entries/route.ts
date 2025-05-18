import { getEntries } from '@/lib/actions';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const ITEMS_PER_PAGE_DEFAULT = 10;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const accion = searchParams.get('accion') || '';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const itemsPerPage = parseInt(searchParams.get('itemsPerPage') || ITEMS_PER_PAGE_DEFAULT.toString());

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  try {
    const filters = {
      search,
      accion,
      from,
      to,
      page,
      itemsPerPage
    };

    const result = await getEntries(filters, { user: { id: session.user.id } });
    // console.log('result', result)
    return NextResponse.json({
      data: result.entries,
      total: result.total,
      totalPages: result.totalPages,
      currentPage: page
    });
  } catch (error) {
    console.error('Error fetching entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch entries' },
      { status: 500 }
    );
  }
}
