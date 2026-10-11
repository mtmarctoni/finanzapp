import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { deleteSafeboxMovement } from '@/lib/safeboxActions';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);

  if (!session?.user.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const result = await deleteSafeboxMovement(id, {
      user: { id: session.user.id },
    });

    if (result === 'not-found') {
      return NextResponse.json(
        { error: 'Movimiento no encontrado' },
        { status: 404 },
      );
    }

    if (result === 'insufficient-funds') {
      return NextResponse.json(
        {
          error:
            'No se puede eliminar: el saldo esperado de la caja fuerte quedaría negativo.',
          reason: 'insufficient-funds',
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('Error deleting safebox movement:', error);
    return NextResponse.json(
      { error: 'Failed to delete safebox movement' },
      { status: 500 },
    );
  }
}
