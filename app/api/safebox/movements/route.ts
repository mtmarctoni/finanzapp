import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { CreateSafeboxMovementSchema } from '@/lib/safebox/validation';
import {
  createSafeboxMovement,
  getSafeboxMovements,
} from '@/lib/safeboxActions';

const REJECTION_MESSAGES = {
  'opening-required':
    'El primer movimiento debe ser el saldo inicial de la caja fuerte.',
  'opening-exists': 'El saldo inicial ya está registrado.',
  'insufficient-funds':
    'No hay suficiente efectivo esperado en la caja fuerte para este movimiento.',
} as const;

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const movements = await getSafeboxMovements({
      user: { id: session.user.id },
    });
    return NextResponse.json({ data: movements });
  } catch (error) {
    console.error('Error fetching safebox movements:', error);
    return NextResponse.json(
      { error: 'Failed to fetch safebox movements' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = CreateSafeboxMovementSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid movement data',
          details: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    const result = await createSafeboxMovement(parsed.data, {
      user: { id: session.user.id },
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: REJECTION_MESSAGES[result.reason], reason: result.reason },
        { status: 409 },
      );
    }

    return NextResponse.json(result.movement, { status: 201 });
  } catch (error) {
    console.error('Error creating safebox movement:', error);
    return NextResponse.json(
      { error: 'Failed to create safebox movement' },
      { status: 500 },
    );
  }
}
