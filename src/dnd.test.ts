import { describe, expect, it, vi } from 'vitest'
import { reorderKeyProps } from './dnd'

function keyEvent(key: string, altKey: boolean) {
  return { key, altKey, preventDefault: vi.fn() } as unknown as Parameters<ReturnType<typeof reorderKeyProps>['onKeyDown']>[0]
}

describe('reorderKeyProps', () => {
  it('é focável via tabIndex', () => {
    expect(reorderKeyProps(() => {}).tabIndex).toBe(0)
  })

  it('Alt+ArrowUp move para cima e previne o padrão', () => {
    const onMove = vi.fn()
    const event = keyEvent('ArrowUp', true)
    reorderKeyProps(onMove).onKeyDown(event)
    expect(onMove).toHaveBeenCalledWith(-1)
    expect(event.preventDefault).toHaveBeenCalledOnce()
  })

  it('Alt+ArrowDown move para baixo', () => {
    const onMove = vi.fn()
    reorderKeyProps(onMove).onKeyDown(keyEvent('ArrowDown', true))
    expect(onMove).toHaveBeenCalledWith(1)
  })

  it('ArrowDown sem Alt não move', () => {
    const onMove = vi.fn()
    reorderKeyProps(onMove).onKeyDown(keyEvent('ArrowDown', false))
    expect(onMove).not.toHaveBeenCalled()
  })

  it('outras teclas com Alt não movem', () => {
    const onMove = vi.fn()
    reorderKeyProps(onMove).onKeyDown(keyEvent('ArrowLeft', true))
    expect(onMove).not.toHaveBeenCalled()
  })
})
