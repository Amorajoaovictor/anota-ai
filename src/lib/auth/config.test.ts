import { afterEach, describe, expect, it } from 'vitest'
import { getNeonAuthConfig, readNeonAuthEnvironment } from './config'

describe('configuração Neon Auth', () => {
  it('rejeita configuração parcial para não iniciar autenticação sem proteção consistente', () => {
    expect(getNeonAuthConfig({ NEON_AUTH_BASE_URL: 'https://auth.example.com' })).toBeNull()
    expect(getNeonAuthConfig({ NEON_AUTH_COOKIE_SECRET: 'a'.repeat(32) })).toBeNull()
  })

  it('aceita URL e segredo com tamanho seguro', () => {
    expect(getNeonAuthConfig({
      NEON_AUTH_BASE_URL: 'https://auth.example.com',
      NEON_AUTH_COOKIE_SECRET: 'a'.repeat(32),
    })).toEqual({
      baseUrl: 'https://auth.example.com',
      cookieSecret: 'a'.repeat(32),
    })
  })
})

describe('leitura do ambiente', () => {
  const original = { url: process.env.NEON_AUTH_BASE_URL, secret: process.env.NEON_AUTH_COOKIE_SECRET }

  afterEach(() => {
    process.env.NEON_AUTH_BASE_URL = original.url
    process.env.NEON_AUTH_COOKIE_SECRET = original.secret
  })

  it('expoe apenas as chaves usadas pela autenticacao', () => {
    process.env.NEON_AUTH_BASE_URL = 'https://auth.example.com'
    process.env.NEON_AUTH_COOKIE_SECRET = 'b'.repeat(32)

    expect(readNeonAuthEnvironment()).toEqual({
      NEON_AUTH_BASE_URL: 'https://auth.example.com',
      NEON_AUTH_COOKIE_SECRET: 'b'.repeat(32),
    })
  })
})
