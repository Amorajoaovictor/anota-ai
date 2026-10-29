import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnauthorizedError } from '../../../../server/http'

const fakes = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
  buildHarnessOperationalHealth: vi.fn(),
  readHarnessV2Config: vi.fn(),
}))

vi.mock('../../../../lib/auth/server', () => ({ requireCurrentUserId: fakes.requireCurrentUserId }))
vi.mock('../../../../lib/prisma', () => ({ getPrisma: () => ({}) }))
vi.mock('../../../../server/ai/harness/config', () => ({ readHarnessV2Config: fakes.readHarnessV2Config }))
vi.mock('../../../../server/ai/harness/metrics', () => ({ buildHarnessOperationalHealth: fakes.buildHarnessOperationalHealth }))

import { GET } from './route'

describe('GET /api/jobs/health', () => {
  beforeEach(() => {
    fakes.requireCurrentUserId.mockReset().mockResolvedValue('owner-1')
    fakes.readHarnessV2Config.mockReset().mockReturnValue({ enabled: true })
    fakes.buildHarnessOperationalHealth.mockReset().mockResolvedValue({
      status: 'warning',
      queue: { backlog: 2, oldestJobAgeMs: 30_000, activeWorkers: 1 },
      alerts: [{ code: 'BACKLOG_HIGH', severity: 'warning' }],
      rollout: { enabledForRequestOwner: true },
    })
  })

  /**
   * Protege: health operacional exige sessao.
   * Detecta: endpoint publico revelando volume/estado interno da fila.
   * Impacto: informacao operacional fica exposta a terceiros.
   */
  it('recusa acesso sem autenticacao', async () => {
    fakes.requireCurrentUserId.mockRejectedValueOnce(new UnauthorizedError())
    const response = await GET(new Request('http://localhost/api/jobs/health'), undefined)
    expect(response.status).toBe(401)
    expect(fakes.buildHarnessOperationalHealth).not.toHaveBeenCalled()
  })

  /**
   * Protege: consulta e resposta ficam no owner autenticado e usam somente metricas tecnicas.
   * Detecta: rota aceitando ownerId do cliente ou serializando config/env/payload.
   * Impacto: vazamento entre contas e exposicao de segredo.
   */
  it('retorna snapshot tecnico owner-scoped sem secrets', async () => {
    const response = await GET(new Request('http://localhost/api/jobs/health?ownerId=owner-2'), undefined)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(fakes.buildHarnessOperationalHealth).toHaveBeenCalledWith(expect.anything(), 'owner-1', expect.anything())
    expect(JSON.stringify(body)).not.toMatch(/payload|apiKey|databaseUrl|owner-2/i)
    expect(body.health.queue.backlog).toBe(2)
  })
})
