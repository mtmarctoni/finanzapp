import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
  checkPreviewMutation,
  mutationResponse,
  authorizePreviewWork,
  PreviewMutationError,
} from '@/lib/demo/mutations';
import { isPreviewDemo } from '@/lib/demo/policy';
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

  const rejection = await checkPreviewMutation(request.headers);
  if (rejection) return mutationResponse(rejection);
  try {
    if (isPreviewDemo())
      await deleteMerchantById(id, session.user.id, async (units) =>
        authorizePreviewWork(request.headers, units),
      );
    else await deleteMerchantById(id, session.user.id);
  } catch (error) {
    if (error instanceof PreviewMutationError)
      return mutationResponse(error.result);
    throw error;
  }
  logger.info(`[Merchants] Forgot merchant ${id}`);

  return NextResponse.json({ success: true });
}
