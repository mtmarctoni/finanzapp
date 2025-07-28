'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getRecurringRecords, createRecurringRecord, updateRecurringRecord, deleteRecurringRecord } from '@/lib/recurringActions';

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id
    const result = await getRecurringRecords(userId);

    return Response.json(result)
  } catch (error) {
    console.error('Error fetching recurring records:', error)
    return Response.json({ error: 'Failed to fetch recurring records' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id
    const { name, accion, tipo, detalle1, detalle2, amount, frequency, active = true, plataforma_pago = 'any', dia = 1 } = await request.json()

    if (!name || !amount || !tipo || !frequency || !plataforma_pago || !accion) {
      throw new Error('Todos los campos son requeridos')
    }
    const data = {
      name,
      accion,
      tipo,
      detalle1,
      detalle2,
      amount,
      frequency,
      active,
      plataforma_pago,
      dia,
      user_id: userId
    }
    const result = await createRecurringRecord(data);

    // const result = await sql`
    //   INSERT INTO recurring_records (name, accion, tipo, detalle1, detalle2, amount, frequency, active, plataforma_pago, dia)
    //   VALUES (${name}, ${accion}, ${tipo}, ${detalle1}, ${detalle2}, ${amount}, ${frequency}, ${active}, ${plataforma_pago}, ${dia})
    //   RETURNING *
    // `
    return Response.json(result)
  } catch (error) {
    console.error('Error adding recurring record:', error)
    return Response.json({ error: 'Failed to add recurring record' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id
    const { id, name, accion, tipo, detalle1, detalle2, amount, frequency, active, plataforma_pago, dia } = await request.json()

    if (!id || !name || !amount || !tipo || !frequency || !plataforma_pago || !accion) {
      throw new Error('Todos los campos son requeridos')
    }

    const result = await updateRecurringRecord(id, {
      name,
      accion,
      tipo,
      detalle1,
      detalle2,
      amount,
      frequency,
      active,
      plataforma_pago,
      dia
    }, userId);


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

    return Response.json({ id })
  } catch (error) {
    console.error('Error updating recurring record:', error)
    return Response.json({ error: 'Failed to update recurring record' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    const { id } = await request.json()

    const result = await deleteRecurringRecord(id, userId);

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

    return Response.json(result)
  } catch (error) {
    console.error('Error deleting recurring record:', error)
    return Response.json({ error: 'Failed to delete recurring record' }, { status: 500 })
  }
}
