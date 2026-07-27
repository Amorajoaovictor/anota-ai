import { describe, expect, it, vi } from 'vitest'
import { signOutSession } from './sign-out'

describe('signOutSession', () => {
  it('encerra sessao e confirma sucesso', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null })

    await expect(signOutSession(signOut)).resolves.toEqual({ error: null })
    expect(signOut).toHaveBeenCalledOnce()
  })

  it('mantem mensagem de erro do provedor', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: { message: 'Sessao ja encerrada.' } })

    await expect(signOutSession(signOut)).resolves.toEqual({ error: 'Sessao ja encerrada.' })
  })

  it('converte excecao do provedor em mensagem para interface', async () => {
    const signOut = vi.fn().mockRejectedValue(new Error('Failed to fetch'))

    await expect(signOutSession(signOut)).resolves.toEqual({ error: 'Failed to fetch' })
  })
})
