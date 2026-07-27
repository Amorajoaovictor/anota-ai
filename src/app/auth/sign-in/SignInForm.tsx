'use client'

import { type FormEvent, useState } from 'react'
import { authClient } from '../../../lib/auth/client'
import { signInWithPassword } from '../../../lib/auth/sign-in'

type AuthFieldProps = {
  id: string
  label: string
  type: 'email' | 'password'
  autoComplete: string
}

function AuthField({ id, label, type, autoComplete }: AuthFieldProps) {
  return (
    <label className="auth-field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} name={id} type={type} autoComplete={autoComplete} required />
    </label>
  )
}

export function SignInForm() {
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '')
    const password = String(form.get('password') ?? '')

    setError(null)
    setIsSubmitting(true)
    const result = await signInWithPassword(
      { email, password },
      (credentials) => authClient.signIn.email(credentials),
      () => authClient.getSession(),
    )
    setIsSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    window.location.assign('/')
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <AuthField id="email" label="E-mail" type="email" autoComplete="email" />
      <AuthField id="password" label="Senha" type="password" autoComplete="current-password" />
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="auth-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  )
}
