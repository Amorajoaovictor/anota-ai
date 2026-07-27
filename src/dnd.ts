'use client'

import { useRef, useState, useSyncExternalStore, type DragEvent } from 'react'

export type DragItemType = 'task' | 'note' | 'plan'
export type DragItem = { type: DragItemType; id: string; from: string }

let current: DragItem | null = null
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function startDrag(item: DragItem) {
  current = item
  emit()
}

export function endDrag() {
  if (!current) return
  current = null
  emit()
}

export function getDragItem(): DragItem | null {
  return current
}

export function useDragItem(): DragItem | null {
  return useSyncExternalStore(subscribe, () => current, () => null)
}

export function dragHandleProps(item: DragItem) {
  return {
    draggable: true,
    onDragStart(event: DragEvent<HTMLElement>) {
      event.stopPropagation()
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', item.id)
      startDrag(item)
    },
    onDragEnd() {
      endDrag()
    },
  }
}

export type DropZone = {
  active: boolean
  over: boolean
  dropProps: {
    onDragEnter: (event: DragEvent<HTMLElement>) => void
    onDragOver: (event: DragEvent<HTMLElement>) => void
    onDragLeave: (event: DragEvent<HTMLElement>) => void
    onDrop: (event: DragEvent<HTMLElement>) => void
  }
}

export function useDropZone(accept: (item: DragItem) => boolean, onDrop: (item: DragItem) => void): DropZone {
  const [over, setOver] = useState(false)
  const depth = useRef(0)
  const item = useDragItem()
  const active = item ? accept(item) : false

  function reset() {
    depth.current = 0
    setOver(false)
  }

  // The handlers read the live drag item instead of the rendered snapshot: a drop can
  // arrive before React re-renders with the item that started the drag.
  function accepted() {
    const live = getDragItem()
    return live && accept(live) ? live : null
  }

  return {
    active,
    over: active && over,
    dropProps: {
      onDragEnter(event) {
        if (!accepted()) return
        event.preventDefault()
        depth.current += 1
        setOver(true)
      },
      onDragOver(event) {
        if (!accepted()) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
      },
      onDragLeave() {
        if (!accepted()) return
        depth.current -= 1
        if (depth.current <= 0) reset()
      },
      onDrop(event) {
        const live = accepted()
        if (!live) return
        event.preventDefault()
        event.stopPropagation()
        reset()
        onDrop(live)
        endDrag()
      },
    },
  }
}
