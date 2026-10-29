import { getNeonAuthOrigin } from '../../../../lib/auth/config'
import { isSameHostRequest, withUpstreamOrigin } from '../../../../lib/auth/origin'
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

/** Sem isso o Neon responde `INVALID_ORIGIN` para o domínio do deploy; ver `lib/auth/origin.ts`. */
function toUpstreamRequest(request: Request, init: { method: string; body?: string }) {
  const upstreamOrigin = getNeonAuthOrigin()
  return new Request(request.url, {
    method: init.method,
    headers: upstreamOrigin ? withUpstreamOrigin(request.headers, upstreamOrigin) : request.headers,
    ...(init.body === undefined ? {} : { body: init.body }),
  })
}

export async function GET(request: Request, context: RouteContext) {
  const rejection = await rejectNonPasswordRoute(context)
  if (rejection) return rejection
  if (!isSameHostRequest(request)) return new Response(null, { status: 403 })

  const handler = getNeonAuth().handler()
  return normalizeLocalhostCookies(
    request,
    await retryWhile(() => handler.GET(toUpstreamRequest(request, { method: 'GET' }), context), isUpstreamTransportFailure),
  )
}

export async function POST(request: Request, context: RouteContext) {
  const rejection = await rejectNonPasswordRoute(context)
  if (rejection) return rejection
  if (!isSameHostRequest(request)) return new Response(null, { status: 403 })

  const handler = getNeonAuth().handler()
  // O corpo só pode ser lido uma vez: guarda para poder repetir a chamada ao upstream.
  const body = await request.text()
  return normalizeLocalhostCookies(
    request,
    await retryWhile(
      () => handler.POST(toUpstreamRequest(request, { method: 'POST', body }), context),
      isUpstreamTransportFailure,
    ),
  )
}
