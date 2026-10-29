export type PasswordCredentials = {
  email: string
  password: string
}

type PasswordSignIn = (credentials: PasswordCredentials) => Promise<{
  error?: { message?: string } | null
}>

type SessionReader = () => Promise<{
  data?: { user?: unknown } | null
  error?: { message?: string } | null
}>

type Wait = (milliseconds: number) => Promise<void>

/** Espera entre as consultas de sessão: o cookie recém-emitido pode ainda não estar visível. */
const SESSION_RETRY_DELAYS_MS = [100, 300]

const sleep: Wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

export async function signInWithPassword(
  credentials: PasswordCredentials,
  signIn: PasswordSignIn,
  getSession?: SessionReader,
  wait: Wait = sleep,
) {
  try {
    const { error } = await signIn(credentials)
    if (error) return { error: error.message ?? 'Não foi possível entrar.' }

    if (getSession) {
      let lastSession: Awaited<ReturnType<SessionReader>> | undefined
      for (let attempt = 0; attempt <= SESSION_RETRY_DELAYS_MS.length; attempt += 1) {
        if (attempt > 0) await wait(SESSION_RETRY_DELAYS_MS[attempt - 1])
        const session = await getSession()
        if (session.data?.user) return { error: null }
        lastSession = session
      }

      return { error: lastSession?.error?.message ?? 'Não foi possível confirmar sua sessão. Tente entrar novamente.' }
    }

    return { error: null }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Não foi possível entrar.' }
  }
}
