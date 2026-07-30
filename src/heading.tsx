'use client'

import { PageHeading } from './ui'

/** Casca fina sobre `PageHeading`, compartilhada pelas telas movidas de `phase1.tsx`. */
export function Heading({ level, eyebrow, title, icon, subtitle, action }: { level?: 'page' | 'section'; eyebrow?: string; title: string; icon?: React.ReactNode; subtitle?: string; action?: React.ReactNode }) {
  return <PageHeading level={level} eyebrow={eyebrow} title={title} icon={icon} subtitle={subtitle} action={action} />
}
