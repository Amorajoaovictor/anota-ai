import { createNeonAuth } from '@neondatabase/auth/next/server'
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

export async function requireCurrentUserId() {
  const { data } = await getNeonAuth().getSession()
  if (!data?.user) throw new Error('Não autenticado.')
  return data.user.id
}
