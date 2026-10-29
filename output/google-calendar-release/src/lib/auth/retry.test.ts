import { describe, expect, it, vi } from 'vitest'
import { isSuspectLoginRedirect, isUpstreamTransportFailure, retryWhile } from './retry'

describe('retryWhile', () => {
  it('devolve primeiro resultado quando nao e transitorio', async () => {
    const run = vi.fn().mockResolvedValue({ status: 200 })

    await expect(retryWhile(run, isUpstreamTransportFailure)).resolves.toEqual({ status: 200 })
    expect(run).toHaveBeenCalledOnce()
  })

  it('reexecuta ate sair da falha de transporte', async () => {
    const run = vi.fn()
      .mockResolvedValueOnce({ status: 502 })
      .mockResolvedValueOnce({ status: 200 })

    await expect(retryWhile(run, isUpstreamTransportFailure)).resolves.toEqual({ status: 200 })
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('respeita o limite de tentativas', async () => {
    const run = vi.fn().mockResolvedValue({ status: 502 })

    await expect(retryWhile(run, isUpstreamTransportFailure)).resolves.toEqual({ status: 502 })
    expect(run).toHaveBeenCalledTimes(3)
  })
})

describe('isSuspectLoginRedirect', () => {
  const cookies = ['__Secure-neon-auth.session_token']

  it('aponta redirect de login feito com cookie de sessao presente', () => {
    expect(isSuspectLoginRedirect(307, 'http://localhost:3000/auth/sign-in', cookies, '/auth/sign-in')).toBe(true)
  })

  it('ignora redirect quando nao ha cookie do Neon Auth', () => {
    expect(isSuspectLoginRedirect(307, 'http://localhost:3000/auth/sign-in', ['outro'], '/auth/sign-in')).toBe(false)
  })

  it('ignora resposta liberada pelo middleware', () => {
    expect(isSuspectLoginRedirect(200, null, cookies, '/auth/sign-in')).toBe(false)
  })

  it('ignora redirect para destino diferente do login', () => {
    expect(isSuspectLoginRedirect(307, 'http://localhost:3000/outra-rota', cookies, '/auth/sign-in')).toBe(false)
  })
})
