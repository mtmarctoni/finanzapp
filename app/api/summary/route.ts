import { NextRequest, NextResponse } from 'next/server'
import { getSummaryStats } from '@/lib/server-data'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') || undefined

    const stats = await getSummaryStats(month, null, request)
    
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching summary stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch summary stats' },
      { status: 500 }
    )
  }
}
