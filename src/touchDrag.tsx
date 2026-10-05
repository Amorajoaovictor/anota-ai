'use client'

import { DotsSixVertical } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { endDrag, startDrag, type DragItem } from './dnd'

type Destination = { accept: (item: DragItem) => boolean; drop: (item: DragItem) => void; hover: (over: boolean) => void }
const destinations = new WeakMap<Element, Destination>()

/** Opt-in touch support: reuse the same acceptance rules as desktop drop zones. */
export function useTouchDropZone(accept: Destination['accept'], drop: Destination['drop']) {
  const latest = useRef({ accept, drop })
  latest.current = { accept, drop }
  const previous = useRef<HTMLElement | null>(null)
  const [over, setOver] = useState(false)
  const ref = useCallback((element: HTMLElement | null) => {
    if (previous.current) destinations.delete(previous.current)
    previous.current = element
    if (element) destinations.set(element, { accept: item => latest.current.accept(item), drop: item => latest.current.drop(item), hover: setOver })
  }, [])
  return { ref, over }
}

function destinationAt(x: number, y: number, item: DragItem) {
  let element: Element | null = document.elementFromPoint?.(x, y) ?? null
  while (element) {
    const destination = destinations.get(element)
    if (destination) return destination.accept(item) ? { element, destination } : null
    element = element.parentElement
  }
  return null
}

/** A dedicated touch-action:none grip leaves card taps and timeline swipes intact. */
export function TouchDragHandle({ item, label }: { item: DragItem; label: string }) {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null)
  const gesture = useRef<{ pointerId: number; item: DragItem; originX: number; originY: number; x: number; y: number; active: boolean; handle: HTMLButtonElement; root: Element | null } | null>(null)
  const hovered = useRef<ReturnType<typeof destinationAt>>(null)
  const frame = useRef<number | null>(null)

  function highlight() {
    const current = gesture.current
    const target = current?.active ? destinationAt(current.x, current.y, current.item) : null
    if (hovered.current?.element === target?.element) return
    hovered.current?.destination.hover(false)
    hovered.current = target
    target?.destination.hover(true)
  }

  function clear() {
    const current = gesture.current
    gesture.current = null
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    hovered.current?.destination.hover(false)
    hovered.current = null
    if (current?.active) endDrag()
    if (current?.handle.hasPointerCapture?.(current.pointerId)) current.handle.releasePointerCapture(current.pointerId)
  }

  function cancel() { clear(); setPoint(null) }
  useEffect(() => () => clear(), [])

  function autoScroll() {
    const current = gesture.current
    if (!current?.active) return
    current.root?.querySelectorAll<HTMLElement>('[data-touch-drag-scroll]').forEach(element => {
      const rect = element.getBoundingClientRect()
      if (!rect.width || !rect.height || current.y < rect.top || current.y > rect.bottom) return
      if (current.x >= rect.left && current.x < rect.left + 32) element.scrollLeft -= 12
      if (current.x <= rect.right && current.x > rect.right - 32) element.scrollLeft += 12
      if (current.y < rect.top + 32) element.scrollTop -= 12
      if (current.y > rect.bottom - 32) element.scrollTop += 12
    })
    if (current.y < 48) window.scrollBy(0, -12)
    if (current.y > window.innerHeight - 80) window.scrollBy(0, 12)
    highlight()
    frame.current = requestAnimationFrame(autoScroll)
  }

  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId) return
    event.preventDefault(); event.stopPropagation()
    current.x = event.clientX; current.y = event.clientY
    if (!current.active && Math.hypot(current.x - current.originX, current.y - current.originY) < 8) return
    if (!current.active) { current.active = true; startDrag(current.item); frame.current = requestAnimationFrame(autoScroll) }
    setPoint({ x: current.x, y: current.y })
    highlight()
  }

  return <>
    <button type="button" className="roadmap-touch-handle" aria-label={`Arrastar ${label}`} title="Arraste para mudar a data" draggable={false} data-active={!!point}
      onClick={event => { event.preventDefault(); event.stopPropagation() }}
      onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') cancel() }}
      onPointerDown={event => {
        if (event.button !== 0 || gesture.current) return
        event.preventDefault(); event.stopPropagation()
        gesture.current = { pointerId: event.pointerId, item, originX: event.clientX, originY: event.clientY, x: event.clientX, y: event.clientY, active: false, handle: event.currentTarget, root: event.currentTarget.closest('[data-touch-drag-root]') }
        event.currentTarget.setPointerCapture?.(event.pointerId)
      }}
      onPointerMove={move}
      onPointerUp={event => {
        const current = gesture.current
        if (!current || current.pointerId !== event.pointerId) return
        event.preventDefault(); event.stopPropagation()
        const destination = current.active ? destinationAt(event.clientX, event.clientY, current.item) : null
        // Clear before persistence so a second pointerup/capture-loss cannot repeat it.
        clear(); setPoint(null)
        destination?.destination.drop(current.item)
      }}
      onPointerCancel={cancel} onLostPointerCapture={cancel}><DotsSixVertical size={23} weight="bold" /></button>
    {point && createPortal(<div className="roadmap-touch-preview" role="status" style={{ left: Math.max(8, Math.min(point.x + 14, window.innerWidth - 188)), top: Math.max(8, Math.min(point.y + 18, window.innerHeight - 80)) }}><strong>{label}</strong><span>Solte sobre a data desejada</span></div>, document.body)}
  </>
}
