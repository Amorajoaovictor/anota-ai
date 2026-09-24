import { randomUUID } from 'node:crypto'
import { requireCurrentUserId } from '../../lib/auth/server'
import { HttpError, toErrorResponse } from '../http'

type Handler<Context> = (input: { ownerId: string; request: Request; context: Context; requestId: string }) => Promise<Response>

export function withMcpOwner<Context = unknown>(handler: Handler<Context>) {
  return async (request: Request, context: Context) => {
    const requestId = randomUUID()
    try {
      const ownerId = await requireCurrentUserId()
      const response = await handler({ ownerId, request, context, requestId })
      response.headers.set('x-request-id', requestId)
      response.headers.set('Cache-Control', 'no-store')
      return response
    } catch (error) {
      if (!(error instanceof HttpError)) {
        console.error(JSON.stringify({ event: 'mcp.request_failed', requestId, endpoint: new URL(request.url).pathname,
          method: request.method, error: serializeError(error),
        }))
      }
      const response = toErrorResponse(error)
      response.headers.set('x-request-id', requestId)
      response.headers.set('Cache-Control', 'no-store')
      return response
    }
  }
}

function serializeError(error: unknown) {
  if (!(error instanceof Error)) return { name: 'NonError', message: String(error) }
  return { name: error.name, message: error.message, stack: error.stack,
    cause: error.cause instanceof Error ? { name: error.cause.name, message: error.cause.message, stack: error.cause.stack } : error.cause,
  }
}
