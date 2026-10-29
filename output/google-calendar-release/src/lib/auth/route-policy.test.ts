import { describe, expect, it } from 'vitest'
import { isPasswordOnlyAuthRoute } from './route-policy'

describe('isPasswordOnlyAuthRoute', () => {
  it('permite login por senha e ciclo de sessao', () => {
    expect(isPasswordOnlyAuthRoute(['sign-in', 'email'])).toBe(true)
    expect(isPasswordOnlyAuthRoute(['get-session'])).toBe(true)
    expect(isPasswordOnlyAuthRoute(['sign-out'])).toBe(true)
  })

  it('bloqueia provedores e fluxos vulneraveis fora de senha', () => {
    expect(isPasswordOnlyAuthRoute(['sign-in', 'magic-link'])).toBe(false)
    expect(isPasswordOnlyAuthRoute(['sign-in', 'email-otp'])).toBe(false)
    expect(isPasswordOnlyAuthRoute(['mcp', 'token'])).toBe(false)
    expect(isPasswordOnlyAuthRoute(['oauth2', 'token'])).toBe(false)
    expect(isPasswordOnlyAuthRoute(['sign-up', 'email'])).toBe(false)
  })
})
