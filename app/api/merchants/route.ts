import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { logger } from '@/lib/logger';
import { deleteMerchantById, listMerchants } from '@/lib/merchants/repo';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const merchants = await listMerchants(session.user.id);
  return NextResponse.json({ merchants });
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json(
      { error: "Se requiere el parámetro 'id'." },
      { status: 400 },
    );
  }

  await deleteMerchantById(id, session.user.id);
  logger.info(`[Merchants] Forgot merchant ${id}`);

  return NextResponse.json({ success: true });
}
