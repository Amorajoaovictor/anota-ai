'use client'

import { useEffect, useState } from 'react'
import { Bell, CalendarBlank, ListChecks, Tray } from '@phosphor-icons/react'
import type { Meeting, Task } from './domain'
import { buildTodayReminders } from './notifications'
import { Modal } from './ui/modal'
import './notificationBell.css'

export function NotificationBell({ tasks, meetings, pendingReviewCount, onOpenTask, onOpenMeetings, onOpenInbox }: {
  tasks: Task[]
  meetings: Meeting[]
  pendingReviewCount: number
  onOpenTask: (task: Task) => void
  onOpenMeetings: () => void
  onOpenInbox: () => void
}) {
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    const refresh = () => setNow(new Date())
    refresh()
    const timer = window.setInterval(refresh, 30_000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  const reminders = now ? buildTodayReminders(tasks, meetings, now) : []
  const count = reminders.length + pendingReviewCount
  const select = (navigate: () => void) => { setOpen(false); navigate() }

  return <>
    <button type="button" aria-label={`Notificações${count ? `, ${count} pendentes` : ''}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <Bell size={20} weight={count ? 'fill' : 'regular'} />{count > 0 && <b>{count > 99 ? '99+' : count}</b>}
    </button>
    {open && <Modal title="Notificações" icon={<Bell size={20} />} description="Reuniões e cards de hoje · horário de São Paulo" onClose={() => setOpen(false)} size="sm">
      <div className="notification-list">
        {reminders.map((reminder) => <button type="button" className="notification-item" key={reminder.id} onClick={() => select(() => reminder.task ? onOpenTask(reminder.task) : onOpenMeetings())}>
          {reminder.kind === 'meeting' ? <CalendarBlank size={20} /> : <ListChecks size={20} />}
          <span><strong>{reminder.title}</strong><small>{reminder.detail}</small></span>
        </button>)}
        {!reminders.length && <p className="notification-empty">Nenhum lembrete para hoje.</p>}
        {pendingReviewCount > 0 && <button type="button" className="notification-item" onClick={() => select(onOpenInbox)}>
          <Tray size={20} /><span><strong>{pendingReviewCount} {pendingReviewCount === 1 ? 'revisão pendente' : 'revisões pendentes'}</strong><small>Abrir caixa de entrada</small></span>
        </button>}
      </div>
    </Modal>}
  </>
}
