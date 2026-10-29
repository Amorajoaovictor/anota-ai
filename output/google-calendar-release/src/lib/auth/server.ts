import { createNeonAuth } from '@neondatabase/auth/next/server'
import { UnauthorizedError } from '../../server/http'
import { getNeonAuthConfig, readNeonAuthEnvironment } from './config'

let neonAuth: ReturnType<typeof createNeonAuth> | undefined

export function getNeonAuth() {
  if (neonAuth) return neonAuth
  const config = getNeonAuthConfig(readNeonAuthEnvironment())
  if (!config) throw new Error('Neon Auth não configurado. Defina NEON_AUTH_BASE_URL e NEON_AUTH_COOKIE_SECRET.')
  neonAuth = createNeonAuth({
    baseUrl: config.baseUrl,
    cookies: { secret: config.cookieSecret },
  })
  return neonAuth
}

export type CurrentUser = { id: string; name: string | null; email: string | null }

export async function requireCurrentUser(): Promise<CurrentUser> {
  const { data } = await getNeonAuth().getSession()
  if (!data?.user) throw new UnauthorizedError()
  const user = data.user
  return { id: user.id, name: user.name ?? null, email: user.email ?? null }
}

export async function requireCurrentUserId() {
  return (await requireCurrentUser()).id
}
