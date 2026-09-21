import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeJobStore } from '../../../../test/fake-prisma'

/** Só o que este teste observa da fila fake: o status de cada job semeado. */
type ObservedJobs = { jobs: Array<{ status: string }> }

const fakes = vi.hoisted(() => ({ prisma: undefined as ObservedJobs | undefined }))

/** O `beforeEach` desta suíte sempre semeia a fila; a lista vazia evita asserção sobre estado ausente. */
const queuedJobs = () => fakes.prisma?.jobs ?? []

vi.mock('../../../../lib/prisma', () => ({ getPrisma: () => fakes.prisma }))
vi.mock('../../../../server/audit-log', () => ({ recordAuditEvent: vi.fn().mockResolvedValue(undefined) }))

import { GET, POST } from './route'

const url = 'http://localhost/api/jobs/run'
const token = 'token-de-fila-para-teste'
const cronSecret = 'segredo-do-cron-para-teste'

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
    expect(queuedJobs()[0]?.status).toBe('PENDING')
  })

  it('recusa token inválido', async () => {
    const response = await POST(new Request(url, { method: 'POST', headers: { 'x-jobs-token': 'errado' } }))

    expect(response.status).toBe(401)
    expect(queuedJobs()[0]?.status).toBe('PENDING')
  })

  it('drena a fila com token válido', async () => {
    const response = await POST(new Request(url, { method: 'POST', headers: { 'x-jobs-token': token } }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ claimed: 1, completed: 1, failed: 0 })
    expect(queuedJobs()[0]?.status).toBe('DONE')
  })
})

/** O cron do Vercel chama GET com `Authorization: Bearer ${CRON_SECRET}` — sem header customizado. */
describe('GET /api/jobs/run', () => {
  beforeEach(() => {
    fakes.prisma = createFakeJobStore([
      { id: 'job-1', type: 'reminder.dispatch', runAt: new Date(Date.now() - 60_000) },
    ])
    process.env.CRON_SECRET = cronSecret
  })

  afterEach(() => {
    delete process.env.CRON_SECRET
    delete process.env.JOBS_RUNNER_TOKEN
  })

  it('não expõe o agendamento quando não há segredo configurado', async () => {
    delete process.env.CRON_SECRET

    const response = await GET(new Request(url, { method: 'GET' }))

    expect(response.status).toBe(404)
    expect(queuedJobs()[0]?.status).toBe('PENDING')
  })

  it('recusa bearer inválido ou token da fila manual', async () => {
    process.env.JOBS_RUNNER_TOKEN = token

    const invalid = await GET(new Request(url, {
      method: 'GET',
      headers: { authorization: 'Bearer segredo-errado' },
    }))
    const manual = await GET(new Request(url, { method: 'GET', headers: { 'x-jobs-token': token } }))

    expect(invalid.status).toBe(401)
    expect(manual.status).toBe(401)
    expect(queuedJobs()[0]?.status).toBe('PENDING')
  })

  it('drena a fila com o bearer do cron', async () => {
    const response = await GET(new Request(url, {
      method: 'GET',
      headers: { authorization: `Bearer ${cronSecret}` },
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ claimed: 1, completed: 1, failed: 0 })
    expect(queuedJobs()[0]?.status).toBe('DONE')
  })
})
