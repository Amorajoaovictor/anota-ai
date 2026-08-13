import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getNeonAuthConfig, readNeonAuthEnvironment } from './lib/auth/config'
import { isSuspectLoginRedirect, retryWhile } from './lib/auth/retry'
import { getNeonAuth } from './lib/auth/server'

const LOGIN_URL = '/auth/sign-in'

export default function proxy(request: NextRequest) {
  if (!getNeonAuthConfig(readNeonAuthEnvironment())) {
    return new NextResponse('Neon Auth não configurado.', { status: 503 })
  }
  const guard = getNeonAuth().middleware({ loginUrl: LOGIN_URL })
  const cookieNames = request.cookies.getAll().map((cookie) => cookie.name)
  return retryWhile(
    () => guard(request),
    (response) => isSuspectLoginRedirect(response.status, response.headers.get('location'), cookieNames, LOGIN_URL),
  )
}

export const config = {
  /**
   * O redirecionamento para login vale só para páginas. As rotas `/api` respondem JSON:
   * as de dados exigem sessão em `withOwner` (401) e a fila valida o próprio token.
   * O manifest e o ícone ficam de fora porque o navegador os busca sem credencial:
   * atrás do guard, a instalação como PWA receberia o HTML do login.
   */
  matcher: ['/((?!api|_next|favicon.ico|icon.svg|manifest.webmanifest|impeccable-preview).*)'],
}
