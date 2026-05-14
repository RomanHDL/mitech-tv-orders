import { NextResponse } from 'next/server'
import { STACK } from '@/lib/stack'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(
    { ...STACK, generated: new Date().toISOString() },
    {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    }
  )
}
