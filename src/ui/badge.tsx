'use client'

import type { ReactNode } from 'react'
import type { Priority, Tag, TaskStatus } from '../domain'

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

export type BadgeProps = {
  children: ReactNode
  tone?: BadgeTone
  icon?: ReactNode
  color?: string
  title?: string
  className?: string
}

export function Badge({ children, tone = 'neutral', icon, color, title, className }: BadgeProps) {
  const classes = ['ui-badge', `ui-badge-${tone}`, className].filter(Boolean).join(' ')
  return <span
    className={classes}
    title={title}
    style={color ? { '--badge-color': color } as React.CSSProperties : undefined}
  >{icon}{children}</span>
}

const priorityTone: Record<Priority, BadgeTone> = { P0: 'danger', P1: 'warning', P2: 'info', P3: 'neutral' }

export function PriorityPill({ priority }: { priority: Priority }) {
  return <Badge tone={priorityTone[priority]} className="priority-pill-legacy">{priority}</Badge>
}

/** Kebab local — evita ciclo de import com milestones.tsx, que importa deste barril. */
function slug(value: string): string {
  return value.toLocaleLowerCase().replaceAll(' ', '-').normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const statusTone: Record<TaskStatus, BadgeTone> = {
  'Backlog': 'neutral',
  'Em andamento': 'success',
  'Bloqueada': 'warning',
  'Em validação': 'info',
  'Concluída': 'neutral',
  'Cancelada': 'danger',
}

export function StatusPill({ status }: { status: TaskStatus }) {
  return <span className={`status-pill ${slug(status)}`}>{status}</span>
}

export function TagChips({ tags, empty }: { tags: Tag[]; empty?: string }) {
  if (!tags.length) return empty ? <span className="tag-chips-empty">{empty}</span> : null
  return <span className="tag-chips">{tags.map((tag) =>
    <span className="tag-chip" key={tag.id} style={{ '--tag-color': tag.color } as React.CSSProperties}>{tag.name}</span>)}</span>
}
