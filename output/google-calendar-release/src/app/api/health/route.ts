import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json({
    status: 'ok',
    databaseConfigured: Boolean(process.env.DATABASE_URL),
  })
}
