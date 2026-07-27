export type NeonAuthConfig = {
  baseUrl: string
  cookieSecret: string
}

/**
 * Lê cada variável por acesso estático a `process.env`: no runtime Edge o Next só substitui
 * `process.env.CHAVE` que consegue analisar em build, e passar o objeto inteiro devolve vazio.
 */
export function readNeonAuthEnvironment(): Record<string, string | undefined> {
  return {
    NEON_AUTH_BASE_URL: process.env.NEON_AUTH_BASE_URL,
    NEON_AUTH_COOKIE_SECRET: process.env.NEON_AUTH_COOKIE_SECRET,
  }
}

export function getNeonAuthConfig(environment: Record<string, string | undefined>): NeonAuthConfig | null {
  const baseUrl = environment.NEON_AUTH_BASE_URL?.trim()
  const cookieSecret = environment.NEON_AUTH_COOKIE_SECRET?.trim()
  if (!baseUrl || !cookieSecret || cookieSecret.length < 32) return null
  return { baseUrl, cookieSecret }
}
