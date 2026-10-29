import { describe, expect, it, vi } from 'vitest'
import { signInWithPassword } from './sign-in'

const credentials = { email: 'teste@exemplo.com', password: 'senha-segura' }

/** Substitui a espera real para o teste não gastar os atrasos de backoff. */
const noWait = vi.fn().mockResolvedValue(undefined)

describe('signInWithPassword', () => {
  it('envia credenciais e confirma sucesso', async () => {
    const signIn = vi.fn().mockResolvedValue({ error: null })

    await expect(signInWithPassword(credentials, signIn)).resolves.toEqual({ error: null })
    expect(signIn).toHaveBeenCalledWith(credentials)
  })

  it('mantem mensagem de erro do provedor', async () => {
    const signIn = vi.fn().mockResolvedValue({ error: { message: 'Origem nao autorizada.' } })

    await expect(signInWithPassword(credentials, signIn)).resolves.toEqual({
      error: 'Origem nao autorizada.',
    })
  })

  it('usa mensagem acentuada quando o provedor recusa sem detalhar', async () => {
    const signIn = vi.fn().mockResolvedValue({ error: {} })

    await expect(signInWithPassword(credentials, signIn)).resolves.toEqual({
      error: 'Não foi possível entrar.',
    })
  })

  it('converte excecao do provedor em mensagem para formulario', async () => {
    const signIn = vi.fn().mockRejectedValue(new Error('Invalid email or password'))

    await expect(signInWithPassword(credentials, signIn)).resolves.toEqual({
      error: 'Invalid email or password',
    })
  })

  it('usa mensagem acentuada quando a excecao nao e um Error', async () => {
    const signIn = vi.fn().mockRejectedValue('falha opaca')

    await expect(signInWithPassword(credentials, signIn)).resolves.toEqual({
      error: 'Não foi possível entrar.',
    })
  })

  it('confirma na primeira consulta sem esperar', async () => {
    const signIn = vi.fn().mockResolvedValue({ error: null })
    const getSession = vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    const wait = vi.fn().mockResolvedValue(undefined)

    await expect(signInWithPassword(credentials, signIn, getSession, wait)).resolves.toEqual({ error: null })
    expect(getSession).toHaveBeenCalledTimes(1)
    expect(wait).not.toHaveBeenCalled()
  })

  it('confirma sessao quando ela fica disponivel na segunda consulta', async () => {
    const signIn = vi.fn().mockResolvedValue({ error: null })
    const getSession = vi.fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null })
    const wait = vi.fn().mockResolvedValue(undefined)

    await expect(signInWithPassword(credentials, signIn, getSession, wait)).resolves.toEqual({ error: null })
    expect(getSession).toHaveBeenCalledTimes(2)
    expect(wait).toHaveBeenCalledExactlyOnceWith(100)
  })

  it('espera de forma crescente entre as tentativas', async () => {
    const signIn = vi.fn().mockResolvedValue({ error: null })
    const getSession = vi.fn().mockResolvedValue({ data: null, error: null })
    const wait = vi.fn().mockResolvedValue(undefined)

    await signInWithPassword(credentials, signIn, getSession, wait)

    expect(wait.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([100, 300])
  })

  it('bloqueia redirecionamento quando sessao continua indisponivel', async () => {
    const signIn = vi.fn().mockResolvedValue({ error: null })
    const getSession = vi.fn().mockResolvedValue({ data: null, error: null })

    await expect(signInWithPassword(credentials, signIn, getSession, noWait)).resolves.toEqual({
      error: 'Não foi possível confirmar sua sessão. Tente entrar novamente.',
    })
    expect(getSession).toHaveBeenCalledTimes(3)
  })

  it('prefere o erro devolvido pela consulta de sessao', async () => {
    const signIn = vi.fn().mockResolvedValue({ error: null })
    const getSession = vi.fn().mockResolvedValue({ data: null, error: { message: 'Sessao expirada.' } })

    await expect(signInWithPassword(credentials, signIn, getSession, noWait)).resolves.toEqual({
      error: 'Sessao expirada.',
    })
  })
})
