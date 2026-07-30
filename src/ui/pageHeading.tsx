'use client'

import type { ReactNode } from 'react'

export type PageHeadingProps = {
  title: string
  level?: 'page' | 'section'
  eyebrow?: string
  icon?: ReactNode
  subtitle?: string
  action?: ReactNode
  className?: string
}

export function PageHeading({ title, level = 'page', eyebrow, icon, subtitle, action, className }: PageHeadingProps) {
  if (level === 'section') {
    const classes = ['page-heading', 'section-heading', 'section-heading-compact', className].filter(Boolean).join(' ')
    return <div className={classes}>
      <div>
        {eyebrow && <span className="eyebrow-inline">{eyebrow}</span>}
        <h1>{icon}{title}</h1>
        {subtitle && <p className="heading-subtitle">{subtitle}</p>}
      </div>
      {action}
    </div>
  }
  const classes = ['page-heading', 'section-heading', className].filter(Boolean).join(' ')
  return <div className={classes}>
    <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{icon}{title}</h1>{subtitle && <p className="heading-subtitle">{subtitle}</p>}</div>
    {action}
  </div>
}
