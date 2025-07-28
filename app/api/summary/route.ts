import { NextRequest, NextResponse } from 'next/server'
import { getSummaryStats } from '@/lib/server-data'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') || undefined

    const stats = await getSummaryStats(month, session, request)

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching summary stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch summary stats' },
      { status: 500 }
    )
  }
}
