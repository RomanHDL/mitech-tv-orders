import { NextResponse } from 'next/server'
import { STACK, toMarkdown } from '@/lib/stack'

export const dynamic = 'force-dynamic'

export async function GET() {
  const md = toMarkdown(STACK, new Date().toISOString())
  return new NextResponse(md, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  })
}
