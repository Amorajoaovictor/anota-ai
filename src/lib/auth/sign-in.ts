export type PasswordCredentials = {
  email: string
  password: string
}

type PasswordSignIn = (credentials: PasswordCredentials) => Promise<{
  error?: { message?: string } | null
}>

export async function signInWithPassword(credentials: PasswordCredentials, signIn: PasswordSignIn) {
  try {
    const { error } = await signIn(credentials)
    return { error: error?.message ?? null }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'NÃ£o foi possÃ­vel entrar.' }
  }
}
