const DEFAULT_ATTEMPTS = 3
const NEON_AUTH_COOKIE_PREFIX = '__Secure-neon-auth'

export async function retryWhile<T>(run: () => Promise<T>, isTransient: (result: T) => boolean, attempts = DEFAULT_ATTEMPTS) {
  let result = await run()
  for (let attempt = 1; attempt < attempts && isTransient(result); attempt += 1) {
    result = await run()
  }
  return result
}

export function isUpstreamTransportFailure(response: { status: number }) {
  return response.status === 502
}

/**
 * O middleware do Neon Auth trata falha de transporte no `get-session` como sessão ausente
 * e redireciona pro login. Só vale reexecutar quando o navegador ainda manda cookie de sessão.
 */
export function isSuspectLoginRedirect(status: number, location: string | null, cookieNames: string[], loginUrl: string) {
  if (status < 300 || status >= 400 || !location) return false
  if (!new URL(location, 'http://redirect.local').pathname.startsWith(loginUrl)) return false
  return cookieNames.some((name) => name.startsWith(NEON_AUTH_COOKIE_PREFIX))
}
