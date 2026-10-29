import type { AnchorHTMLAttributes } from 'react'

/** Mantém copiar link, abrir em outra aba e navegação sem perder o estado local. */
export function NavigationLink({ onNavigate, className = '', ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { onNavigate: () => void }) {
  return <a {...props} className={`navigation-link ${className}`} onClick={(event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onNavigate()
  }} />
}
