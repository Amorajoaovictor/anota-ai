import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeJobStore } from '../../../../test/fake-prisma'

const fakes = vi.hoisted(() => ({ prisma: undefined as any }))

vi.mock('../../../../lib/prisma', () => ({ getPrisma: () => fakes.prisma }))
vi.mock('../../../../server/audit-log', () => ({ recordAuditEvent: vi.fn().mockResolvedValue(undefined) }))

import { POST } from './route'

const url = 'http://localhost/api/jobs/run'
const token = 'token-de-fila-para-teste'

describe('POST /api/jobs/run', () => {
  beforeEach(() => {
    fakes.prisma = createFakeJobStore([
      { id: 'job-1', type: 'reminder.dispatch', runAt: new Date(Date.now() - 60_000) },
    ])
    process.env.JOBS_RUNNER_TOKEN = token
  })

  afterEach(() => {
    delete process.env.JOBS_RUNNER_TOKEN
  })

  it('não expõe o endpoint quando não há token configurado', async () => {
    delete process.env.JOBS_RUNNER_TOKEN

    const response = await POST(new Request(url, { method: 'POST' }))

    expect(response.status).toBe(404)
    expect(fakes.prisma.jobs[0]?.status).toBe('PENDING')
  })

  it('recusa token inválido', async () => {
    const response = await POST(new Request(url, { method: 'POST', headers: { 'x-jobs-token': 'errado' } }))

    expect(response.status).toBe(401)
    expect(fakes.prisma.jobs[0]?.status).toBe('PENDING')
  })

  it('drena a fila com token válido', async () => {
    const response = await POST(new Request(url, { method: 'POST', headers: { 'x-jobs-token': token } }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ claimed: 1, completed: 1, failed: 0 })
    expect(fakes.prisma.jobs[0]?.status).toBe('DONE')
  })
})
