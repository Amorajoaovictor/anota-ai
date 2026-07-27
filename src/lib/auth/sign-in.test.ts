import { describe, expect, it, vi } from 'vitest'
import { signInWithPassword } from './sign-in'

describe('signInWithPassword', () => {
  it('envia credenciais e confirma sucesso', async () => {
    const signIn = vi.fn().mockResolvedValue({ error: null })

    await expect(signInWithPassword({ email: 'teste@exemplo.com', password: 'senha-segura' }, signIn)).resolves.toEqual({ error: null })
    expect(signIn).toHaveBeenCalledWith({ email: 'teste@exemplo.com', password: 'senha-segura' })
  })

  it('mantem mensagem de erro do provedor', async () => {
    const signIn = vi.fn().mockResolvedValue({ error: { message: 'Origem nao autorizada.' } })

    await expect(signInWithPassword({ email: 'teste@exemplo.com', password: 'senha-segura' }, signIn)).resolves.toEqual({
      error: 'Origem nao autorizada.',
    })
  })

  it('converte excecao do provedor em mensagem para formulario', async () => {
    const signIn = vi.fn().mockRejectedValue(new Error('Invalid email or password'))

    await expect(signInWithPassword({ email: 'teste@exemplo.com', password: 'senha-segura' }, signIn)).resolves.toEqual({
      error: 'Invalid email or password',
    })
  })
})
