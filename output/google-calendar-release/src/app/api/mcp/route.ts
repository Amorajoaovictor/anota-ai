import { createMcpHandler } from '@modelcontextprotocol/server'
import { randomUUID } from 'node:crypto'
import { getPrisma } from '../../../lib/prisma'
import { createAnotaMcpServer } from '../../../server/mcp/server'
import { verifyMcpToken } from '../../../server/mcp/tokens'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function handle(request: Request) {
  const requestId = randomUUID()
  try {
    const origin = request.headers.get('origin')
    if (origin && origin !== new URL(request.url).origin) return new Response(null, { status: 403, headers: { 'x-request-id': requestId } })
    const authorization = request.headers.get('authorization')
    const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1]
    if (!token) return new Response(null, { status: 401, headers: { 'WWW-Authenticate': 'Bearer', 'x-request-id': requestId } })
    const identity = await verifyMcpToken(getPrisma(), token)
    if (!identity) return new Response(null, { status: 401, headers: { 'WWW-Authenticate': 'Bearer', 'x-request-id': requestId } })
    const handler = createMcpHandler(() => createAnotaMcpServer({ ...identity, requestId }), { responseMode: 'json' })
    const response = await handler.fetch(request)
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('x-request-id', requestId)
    return response
  } catch (error) {
    console.error(JSON.stringify({ event: 'mcp.request_failed', requestId, endpoint: '/api/mcp', method: request.method,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack,
        cause: error.cause instanceof Error ? { name: error.cause.name, message: error.cause.message, stack: error.cause.stack } : error.cause } : String(error),
    }))
    return Response.json({ error: 'MCP_REQUEST_FAILED', requestId }, { status: 500, headers: { 'x-request-id': requestId } })
  }
}

export const GET = handle
export const POST = handle
export const DELETE = handle
