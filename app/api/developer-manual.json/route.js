import { NextResponse } from 'next/server'
import { DEVELOPER_MANUAL } from '@/lib/developer-manual'

export const dynamic = 'force-dynamic'

// Requiere sesión (cualquier rol) — cubierto por la regla general de
// middleware.js: "GET de cualquier /api/* = cualquier rol logueado".
export async function GET() {
  return NextResponse.json(DEVELOPER_MANUAL)
}
