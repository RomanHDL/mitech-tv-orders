import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import pkg from '../../../../package.json' assert { type: 'json' }

export const dynamic = 'force-dynamic'

export async function GET() {
  const inicio = Date.now()
  let dbStatus = 'unknown'
  let dbLatencyMs = null

  try {
    const t0 = Date.now()
    const db = await getDb()
    await db.command({ ping: 1 })
    dbLatencyMs = Date.now() - t0
    dbStatus = 'ok'
  } catch (err) {
    dbStatus = 'error'
  }

  const body = {
    name: pkg.name,
    version: pkg.version,
    status: dbStatus === 'ok' ? 'ok' : 'degraded',
    uptimeMs: Date.now() - inicio,
    db: { status: dbStatus, latencyMs: dbLatencyMs },
    generated: new Date().toISOString(),
  }

  return NextResponse.json(body, {
    status: dbStatus === 'ok' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}
