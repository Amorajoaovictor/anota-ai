'use client'

import { useState } from 'react'
import { SignOut } from '@phosphor-icons/react'
import { authClient } from '../lib/auth/client'
import { signOutSession } from '../lib/auth/sign-out'

export function SignOutButton() {
  const [isLeaving, setIsLeaving] = useState(false)

  async function handleClick() {
    setIsLeaving(true)
    await signOutSession(() => authClient.signOut())
    window.location.assign('/auth/sign-in')
  }

  return (
    <button aria-label="Sair" title="Sair" disabled={isLeaving} onClick={handleClick}>
      <SignOut size={20} />
    </button>
  )
}
