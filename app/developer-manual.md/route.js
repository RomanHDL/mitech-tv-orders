import { NextResponse } from 'next/server'
import { developerManualToMarkdown } from '@/lib/developer-manual'

export const dynamic = 'force-dynamic'

export async function GET() {
  const md = developerManualToMarkdown()
  return new NextResponse(md, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  })
}
