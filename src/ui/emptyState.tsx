'use client'

import type { ReactNode } from 'react'

export type EmptyStateProps = {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
  size?: 'inline' | 'panel' | 'page'
}

export function EmptyState({ icon, title, description, action, size = 'panel' }: EmptyStateProps) {
  return <div className="ui-empty" data-size={size}>
    <span className="ui-empty-icon">{icon}</span>
    <strong>{title}</strong>
    {description && <span>{description}</span>}
    {action}
  </div>
}
