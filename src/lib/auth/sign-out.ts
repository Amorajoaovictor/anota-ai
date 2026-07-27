type SessionSignOut = () => Promise<{
  error?: { message?: string } | null
}>

export async function signOutSession(signOut: SessionSignOut) {
  try {
    const { error } = await signOut()
    return { error: error?.message ?? null }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Não foi possível sair.' }
  }
}
