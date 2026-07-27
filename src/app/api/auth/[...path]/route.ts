import { isPasswordOnlyAuthRoute } from '../../../../lib/auth/route-policy'
import { isUpstreamTransportFailure, retryWhile } from '../../../../lib/auth/retry'
import { getNeonAuth } from '../../../../lib/auth/server'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ path: string[] }> }

function normalizeLocalhostCookies(request: Request, response: Response) {
  const { hostname } = new URL(request.url)
  if (process.env.NODE_ENV === 'production' || hostname !== 'localhost') return response

  const cookies = response.headers.getSetCookie()
  if (!cookies.length) return response

  const headers = new Headers(response.headers)
  headers.delete('set-cookie')
  for (const cookie of cookies) {
    const hostOnlyCookie = cookie.replace(/;\s*domain=[^;]*/gi, '')
    const rootPathCookie = /;\s*path=/i.test(hostOnlyCookie)
      ? hostOnlyCookie.replace(/;\s*path=[^;]*/gi, '; Path=/')
      : `${hostOnlyCookie}; Path=/`
    headers.append('set-cookie', rootPathCookie)
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

async function rejectNonPasswordRoute(context: RouteContext) {
  const { path } = await context.params
  return isPasswordOnlyAuthRoute(path) ? null : new Response(null, { status: 404 })
}

export async function GET(request: Request, context: RouteContext) {
  const rejection = await rejectNonPasswordRoute(context)
  if (rejection) return rejection
  const handler = getNeonAuth().handler()
  return normalizeLocalhostCookies(request, await retryWhile(() => handler.GET(request, context), isUpstreamTransportFailure))
}

export async function POST(request: Request, context: RouteContext) {
  const rejection = await rejectNonPasswordRoute(context)
  if (rejection) return rejection
  const handler = getNeonAuth().handler()
  // O corpo só pode ser lido uma vez: guarda para poder repetir a chamada ao upstream.
  const body = await request.text()
  const replay = () => new Request(request.url, { method: 'POST', headers: request.headers, body })
  return normalizeLocalhostCookies(request, await retryWhile(() => handler.POST(replay(), context), isUpstreamTransportFailure))
}
