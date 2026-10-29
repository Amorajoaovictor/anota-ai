'use client'

import { CheckCircle, Info, WarningCircle, X } from '@phosphor-icons/react'
import { useCallback, useRef, useState } from 'react'

export type ToastTone = 'success' | 'error' | 'info'
export type Notify = (message: string, tone?: ToastTone) => void
export type ToastState = { message: string; tone: ToastTone; key: number } | null

const duration: Record<ToastTone, number> = { success: 2400, error: 4500, info: 2400 }

export function useToast(): { toast: ToastState; notify: Notify; dismiss: () => void } {
  const [toast, setToast] = useState<ToastState>(null)
  const timer = useRef<number | undefined>(undefined)
  const key = useRef(0)

  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current)
    setToast(null)
  }, [])

  const notify = useCallback<Notify>((message, tone = 'success') => {
    window.clearTimeout(timer.current)
    key.current += 1
    setToast({ message, tone, key: key.current })
    timer.current = window.setTimeout(() => setToast(null), duration[tone])
  }, [])

  return { toast, notify, dismiss }
}

const icon: Record<ToastTone, typeof CheckCircle> = { success: CheckCircle, error: WarningCircle, info: Info }

export function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  if (!toast) return null
  const Icon = icon[toast.tone]
  const isError = toast.tone === 'error'
  return <div
    key={toast.key}
    className="toast"
    data-tone={toast.tone}
    role={isError ? 'alert' : 'status'}
    aria-live={isError ? 'assertive' : 'polite'}
  >
    <Icon size={20} weight="fill" />
    {toast.message}
    {isError && <button type="button" className="toast-close" aria-label="Fechar aviso" onClick={onDismiss}><X size={14} /></button>}
  </div>
}
