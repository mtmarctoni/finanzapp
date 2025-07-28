'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { generateFinanceEntries } from '@/lib/recurringActions';

export async function POST(request: Request) {
  try {
    // Get the current user session
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id
    console.log('Starting generate request')

    // Get the date from the request body or use today
    const { date } = await request.json()
    console.log('Received date:', date)

    if (!date) {
      throw new Error('No date provided')
    }
    const targetDate = new Date(date)
    const targetYear = targetDate.getFullYear()
    const targetMonth = targetDate.getMonth() + 1
    const { generated } = await generateFinanceEntries(userId, date, targetYear, targetMonth)
    return Response.json({
      success: true,
      message: `Generados ${generated} registros`,
      generated
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('Detailed error:', {
      error,
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    })
    return Response.json({
      error: 'Failed to generate recurring records',
      details: errorMessage
    }, { status: 500 })
  }
}
