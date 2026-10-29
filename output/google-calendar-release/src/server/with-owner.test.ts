import { describe, expect, it, vi } from 'vitest'
import { UnauthorizedError } from './http'
import { jsonRequest } from '../test/request'

const fakes = vi.hoisted(() => ({ requireCurrentUserId: vi.fn() }))

vi.mock('../lib/auth/server', () => ({ requireCurrentUserId: fakes.requireCurrentUserId }))

import { withOwner } from './with-owner'

describe('withOwner', () => {
  it('responde 401 sem sessão e não executa o handler', async () => {
    fakes.requireCurrentUserId.mockRejectedValueOnce(new UnauthorizedError())
    const handler = vi.fn()

    const response = await withOwner(handler)(jsonRequest('http://localhost/api/projects', {}), undefined)

    expect(response.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('entrega o dono autenticado ao handler', async () => {
    fakes.requireCurrentUserId.mockResolvedValueOnce('user-1')

    const response = await withOwner(async ({ ownerId }) => Response.json({ ownerId }))(
      jsonRequest('http://localhost/api/projects', {}),
      undefined,
    )

    await expect(response.json()).resolves.toEqual({ ownerId: 'user-1' })
  })

  it('mapeia erro inesperado do handler para 500', async () => {
    fakes.requireCurrentUserId.mockResolvedValueOnce('user-1')

    const response = await withOwner(async () => { throw new Error('falha interna') })(
      jsonRequest('http://localhost/api/projects', {}),
      undefined,
    )

    expect(response.status).toBe(500)
  })
})
