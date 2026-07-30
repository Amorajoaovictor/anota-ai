'use client'

import { Warning, X } from '@phosphor-icons/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export type ModalProps = {
  onClose: () => void
  title: string
  eyebrow?: string
  icon?: ReactNode
  description?: string
  footer?: ReactNode
  children?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  variant?: 'center' | 'sheet'
  accent?: string
  closeLabel?: string
}

export function Modal({
  onClose,
  title,
  eyebrow,
  icon,
  description,
  footer,
  children,
  size = 'md',
  variant = 'center',
  accent,
  closeLabel = 'Fechar',
}: ModalProps) {
  const surface = useRef<HTMLElement>(null)
  const mounted = useMounted()

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    surface.current?.querySelector<HTMLElement>(focusableSelector)?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') return onClose()
      if (event.key !== 'Tab' || !surface.current) return
      const items = [...surface.current.querySelectorAll<HTMLElement>(focusableSelector)]
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [onClose])

  if (!mounted) return null

  return createPortal(
    <div className={`ui-backdrop ui-backdrop-${variant}`} role="presentation" onMouseDown={onClose}>
      <section
        ref={surface}
        className={`ui-modal ui-modal-${variant} ui-modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={accent ? { '--accent': accent } as React.CSSProperties : undefined}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="ui-modal-header">
          <div className="ui-modal-title">
            {icon && <span className="ui-modal-icon">{icon}</span>}
            <div>
              {eyebrow && <small>{eyebrow}</small>}
              <strong>{title}</strong>
              {description && <span>{description}</span>}
            </div>
          </div>
          <button type="button" className="ui-modal-close" aria-label={closeLabel} onClick={onClose}><X size={18} /></button>
        </header>
        <div className="ui-modal-body">{children}</div>
        {footer && <footer className="ui-modal-footer">{footer}</footer>}
      </section>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  onConfirm,
  onCancel,
}: {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'default'
  onConfirm: () => void
  onCancel: () => void
}) {
  return <Modal
    size="sm"
    title={title}
    icon={<Warning size={20} weight="fill" />}
    onClose={onCancel}
    footer={<>
      <button type="button" className="ghost-button" onClick={onCancel}>{cancelLabel}</button>
      <button type="button" className={tone === 'danger' ? 'danger-button' : 'primary-button'} onClick={onConfirm}>{confirmLabel}</button>
    </>}
  >
    <p className="ui-confirm-text">{description}</p>
  </Modal>
}

function useMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}
