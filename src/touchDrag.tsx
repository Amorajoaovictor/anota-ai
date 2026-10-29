'use client'

import { DotsSixVertical } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState, type PointerEvent, type MouseEvent } from 'react'
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

/** Shared gesture for a grip or a long-press card. Pending presses allow scrolling. */
export function useTouchDrag(item: DragItem, longPress = false) {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null)
  const gesture = useRef<{ pointerId: number; item: DragItem; originX: number; originY: number; x: number; y: number; active: boolean; handle: HTMLElement; root: Element | null } | null>(null)
  const hovered = useRef<ReturnType<typeof destinationAt>>(null)
  const frame = useRef<number | null>(null)
  const press = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressClick = useRef(false)
  // CSS touch-action is fixed at gesture start. A non-passive listener blocks
  // browser panning only after the long press, leaving ordinary swipes intact.
  const blockScroll = useCallback((event: TouchEvent) => {
    if (gesture.current?.active) event.preventDefault()
  }, [])

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
    current?.handle.removeEventListener('touchmove', blockScroll)
    if (press.current !== null) clearTimeout(press.current)
    press.current = null
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

  function move(event: PointerEvent<HTMLElement>) {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId) return
    current.x = event.clientX; current.y = event.clientY
    if (!current.active) {
      if (Math.hypot(current.x - current.originX, current.y - current.originY) < 8) return
      if (longPress) { clear(); return }
    }
    event.preventDefault(); event.stopPropagation()
    if (!current.active) { current.active = true; startDrag(current.item); frame.current = requestAnimationFrame(autoScroll) }
    setPoint({ x: current.x, y: current.y })
    highlight()
  }

  return {
    point,
    cancel,
    dragging: !!point,
    pointerProps: {
      onClickCapture(event: MouseEvent<HTMLElement>) {
        if (!suppressClick.current) return
        suppressClick.current = false
        event.preventDefault(); event.stopPropagation()
      },
      onPointerDown(event: PointerEvent<HTMLElement>) {
        if (event.button !== 0 || gesture.current || (longPress && event.pointerType !== 'touch' && event.pointerType !== 'pen')) return
        if (longPress && (event.target as HTMLElement).closest('button, select, input, a, textarea')) return
        suppressClick.current = false
        if (!longPress) { event.preventDefault(); event.stopPropagation() }
        gesture.current = { pointerId: event.pointerId, item, originX: event.clientX, originY: event.clientY, x: event.clientX, y: event.clientY, active: false, handle: event.currentTarget, root: event.currentTarget.closest('[data-touch-drag-root]') }
        if (longPress) {
          event.currentTarget.addEventListener('touchmove', blockScroll, { passive: false })
          press.current = setTimeout(() => {
            const current = gesture.current
            if (!current) return
            current.active = true
            suppressClick.current = true
            current.handle.setPointerCapture?.(current.pointerId)
            startDrag(current.item)
            setPoint({ x: current.x, y: current.y })
            highlight()
            frame.current = requestAnimationFrame(autoScroll)
          }, 350)
        } else event.currentTarget.setPointerCapture?.(event.pointerId)
      },
      onPointerMove: move,
      onPointerUp(event: PointerEvent<HTMLElement>) {
        const current = gesture.current
        if (!current || current.pointerId !== event.pointerId) return
        if (current.active || !longPress) { event.preventDefault(); event.stopPropagation() }
        if (current.active) suppressClick.current = true
        const destination = current.active ? destinationAt(event.clientX, event.clientY, current.item) : null
        // Clear before persistence so capture loss or a second release cannot repeat it.
        clear(); setPoint(null)
        destination?.destination.drop(current.item)
      },
      onPointerCancel: cancel,
      onLostPointerCapture: cancel,
    },
  }
}

export function TouchDragPreview({ point, label, hint = 'Solte sobre a data desejada' }: { point: { x: number; y: number } | null; label: string; hint?: string }) {
  return point && createPortal(<div className="roadmap-touch-preview" role="status" style={{ left: Math.max(8, Math.min(point.x + 14, window.innerWidth - 188)), top: Math.max(8, Math.min(point.y + 18, window.innerHeight - 80)) }}><strong>{label}</strong><span>{hint}</span></div>, document.body)
}

/** A dedicated touch-action:none grip leaves card taps and timeline swipes intact. */
export function TouchDragHandle({ item, label }: { item: DragItem; label: string }) {
  const drag = useTouchDrag(item)
  return <>
    <button type="button" className="roadmap-touch-handle" aria-label={`Arrastar ${label}`} title="Arraste para mudar a data" draggable={false} data-active={drag.dragging}
      {...drag.pointerProps}
      onClick={event => { event.preventDefault(); event.stopPropagation() }}
      onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') drag.cancel() }}><DotsSixVertical size={23} weight="bold" /></button>
    <TouchDragPreview point={drag.point} label={label} />
  </>
}
