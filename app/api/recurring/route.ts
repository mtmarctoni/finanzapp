'use server';

import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
  getRecurringRecords,
  createRecurringRecord,
  updateRecurringRecord,
  deleteRecurringRecord,
} from '@/lib/recurringActions';
import { ensureCategory } from '@/lib/server-data';

/**
 * Register a newly written `tipo` in the canonical `categories` table so it
 * becomes selectable in the "categoria" dropdown on both /records and /recurring.
 *
 * Best-effort by design: the recurring record has already been saved at this
 * point, so a category-index failure must not fail the request.
 */
async function provisionCategory(userId: string, tipo: string | undefined) {
  if (!tipo?.trim()) return;
  try {
    await ensureCategory(userId, tipo);
  } catch (error) {
    console.error('Failed to provision category:', error);
  }
}

/**
 * Parse a JSON object request body, or return null when the body is not valid
 * JSON or not an object, so callers can answer with a 400 instead of a 500.
 */
async function readJsonObject(request: Request) {
  try {
    const body = await request.json();
    return body !== null && typeof body === 'object' ? body : null;
  } catch {
    return null;
  }
}

const invalidBody = () =>
  Response.json({ error: 'Invalid JSON body' }, { status: 400 });

const missingFields = () =>
  Response.json({ error: 'Todos los campos son requeridos' }, { status: 400 });

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    const result = await getRecurringRecords(userId);

    return Response.json(result);
  } catch (error) {
    console.error('Error fetching recurring records:', error);
    return Response.json(
      { error: 'Failed to fetch recurring records' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    const body = await readJsonObject(request);
    if (!body) return invalidBody();
    const {
      name,
      accion,
      tipo,
      detalle1,
      detalle2,
      quien = 'Yo',
      amount,
      frequency,
      active = true,
      plataforma_pago = 'any',
      dia = 1,
    } = body;

    if (
      !name ||
      !amount ||
      !tipo ||
      !frequency ||
      !plataforma_pago ||
      !accion
    ) {
      return missingFields();
    }
    const data = {
      name,
      accion,
      tipo,
      detalle1,
      detalle2,
      quien,
      amount,
      frequency,
      active,
      plataforma_pago,
      dia,
      user_id: userId,
    };
    const result = await createRecurringRecord(data);
    await provisionCategory(userId, tipo);

    // const result = await sql`
    //   INSERT INTO recurring_records (name, accion, tipo, detalle1, detalle2, amount, frequency, active, plataforma_pago, dia)
    //   VALUES (${name}, ${accion}, ${tipo}, ${detalle1}, ${detalle2}, ${amount}, ${frequency}, ${active}, ${plataforma_pago}, ${dia})
    //   RETURNING *
    // `
    return Response.json(result);
  } catch (error) {
    console.error('Error adding recurring record:', error);
    return Response.json(
      { error: 'Failed to add recurring record' },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    const body = await readJsonObject(request);
    if (!body) return invalidBody();
    const {
      id,
      name,
      accion,
      tipo,
      detalle1,
      detalle2,
      quien,
      amount,
      frequency,
      active,
      plataforma_pago,
      dia,
    } = body;

    if (
      !id ||
      !name ||
      !amount ||
      !tipo ||
      !frequency ||
      !plataforma_pago ||
      !accion
    ) {
      return missingFields();
    }

    await updateRecurringRecord(
      id,
      {
        name,
        accion,
        tipo,
        detalle1,
        detalle2,
        quien,
        amount,
        frequency,
        active,
        plataforma_pago,
        dia,
      },
      userId,
    );
    await provisionCategory(userId, tipo);

    // const result = await sql`
    //   UPDATE recurring_records
    //   SET name = ${name},
    //       accion = ${accion},
    //       tipo = ${tipo},
    //       detalle1 = ${detalle1},
    //       detalle2 = ${detalle2},
    //       amount = ${amount},
    //       frequency = ${frequency},
    //       active = ${active},
    //       plataforma_pago = ${plataforma_pago},
    //       dia = ${dia},
    //       updated_at = CURRENT_TIMESTAMP
    //   WHERE id = ${id}
    //   RETURNING *
    // `

    return Response.json({ id });
  } catch (error) {
    console.error('Error updating recurring record:', error);
    return Response.json(
      { error: 'Failed to update recurring record' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await readJsonObject(request);
    if (!body) return invalidBody();
    const { id } = body;

    const result = await deleteRecurringRecord(id, userId);
    if (!result) {
      return Response.json(
        { error: 'Recurring record not found' },
        { status: 404 },
      );
    }

    // if (!id) {
    //   throw new Error('ID is required')
    // }

    // const result = await sql`
    //   DELETE FROM recurring_records
    //   WHERE id = ${id}
    // `

    // if (result.rowCount === 0) {
    //   throw new Error('Recurring record not found')
    // }

    return Response.json(result);
  } catch (error) {
    console.error('Error deleting recurring record:', error);
    return Response.json(
      { error: 'Failed to delete recurring record' },
      { status: 500 },
    );
  }
}
