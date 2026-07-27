import { isPasswordOnlyAuthRoute } from '../../../../lib/auth/route-policy'
import { isUpstreamTransportFailure, retryWhile } from '../../../../lib/auth/retry'
import { getNeonAuth } from '../../../../lib/auth/server'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ path: string[] }> }

async function rejectNonPasswordRoute(context: RouteContext) {
  const { path } = await context.params
  return isPasswordOnlyAuthRoute(path) ? null : new Response(null, { status: 404 })
}

export async function GET(request: Request, context: RouteContext) {
  const rejection = await rejectNonPasswordRoute(context)
  if (rejection) return rejection
  const handler = getNeonAuth().handler()
  return retryWhile(() => handler.GET(request, context), isUpstreamTransportFailure)
}

export async function POST(request: Request, context: RouteContext) {
  const rejection = await rejectNonPasswordRoute(context)
  if (rejection) return rejection
  const handler = getNeonAuth().handler()
  // O corpo só pode ser lido uma vez: guarda para poder repetir a chamada ao upstream.
  const body = await request.text()
  const replay = () => new Request(request.url, { method: 'POST', headers: request.headers, body })
  return retryWhile(() => handler.POST(replay(), context), isUpstreamTransportFailure)
}
