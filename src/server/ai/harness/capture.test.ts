import { describe, expect, it, vi } from 'vitest'
import { captureHarnessAudio, captureHarnessText } from './capture'

function fakeRepository() {
  const inboxItems: any[] = []
  const runs: any[] = []
  const transcripts: any[] = []
  const jobs: any[] = []
  const repository: any = {
    inboxItem: { create: async ({ data }: any) => {
      const item = { id: `inbox-${inboxItems.length + 1}`, ...data }
      inboxItems.push(item)
      return item
    } },
    aiRun: {
      create: async ({ data }: any) => {
        const run = { id: `run-${runs.length + 1}`, version: 0, activeTranscriptId: null, ...data }
        runs.push(run)
        return run
      },
      update: async ({ where, data }: any) => {
        const run = runs.find((entry) => entry.id === where.id)
        Object.assign(run, data, { version: run.version + (data.version?.increment ?? 0) })
        return run
      },
    },
    transcriptRevision: { create: async ({ data }: any) => {
      transcripts.push(data)
      return data
    } },
    job: {
      create: async ({ data }: any) => {
        const job = { id: `job-${jobs.length + 1}`, ...data }
        jobs.push(job)
        return job
      },
      findUnique: async () => null,
    },
  }
  repository.$transaction = async (callback: (transaction: any) => Promise<unknown>) => callback(repository)
  return { repository, inboxItems, runs, transcripts, jobs }
}

describe('captura de texto no harness v2', () => {
  /**
   * Protege: captura cria snapshot imutavel e job ai.organize na mesma transacao.
   * Detecta: entrada v2 enfileirando classificador legado ou job sem hash/versao.
   * Impacto: fluxo pula editor/aprovacao e volta ao single-shot antigo.
   */
  it('cria run TRANSCRIBED e enfileira somente organizacao', async () => {
    const fake = fakeRepository()

    const result = await captureHarnessText(fake.repository, 'owner-1', { text: 'Decisao integral.' }, {
      maxCharacters: 50_000,
      countTokens: (text) => text.split(/\s+/).length,
    })

    expect(result).toMatchObject({ kind: 'created', inboxItem: { ownerId: 'owner-1' }, aiRun: { status: 'TRANSCRIBED', version: 1 } })
    expect(fake.transcripts).toEqual([expect.objectContaining({
      aiRunId: 'run-1', version: 1, text: 'Decisao integral.', source: 'TEXT', contentHash: expect.any(String),
    })])
    expect(fake.jobs).toEqual([expect.objectContaining({
      type: 'ai.organize', ownerId: 'owner-1', aiRunId: 'run-1', step: 'ORGANIZING', inputVersion: 1,
      inputHash: fake.transcripts[0].contentHash,
    })])
    expect(fake.jobs.some((job) => job.type === 'ai.classify')).toBe(false)
  })

  /**
   * Protege: limite central rejeita antes de persistir, sem truncar.
   * Detecta: componente/rota cortar texto para caber.
   * Impacto: perda silenciosa de informacao e custo em entrada invalida.
   */
  it('rejeita texto vazio ou acima do limite sem escrever', async () => {
    const empty = fakeRepository()
    expect(await captureHarnessText(empty.repository, 'owner-1', { text: '   ' }, { maxCharacters: 10, countTokens: () => 0 })).toMatchObject({ kind: 'invalid' })
    expect(empty.inboxItems).toHaveLength(0)

    const large = fakeRepository()
    const result = await captureHarnessText(large.repository, 'owner-1', { text: '12345678901' }, { maxCharacters: 10, countTokens: (text) => text.length })
    expect(result).toMatchObject({ kind: 'too-large', original: '12345678901' })
    expect(large.inboxItems).toHaveLength(0)
  })
})

describe('captura de audio no harness v2', () => {
  /**
   * Protege: audio vira arquivo temporario + run TRANSCRIBING + job com IDs/hash, nunca bytes no payload.
   * Detecta: flag v2 ainda usando handler legado ou gravando audio grande no Job.payload.
   * Impacto: fila/banco incham e fluxo perde revisao imutavel.
   */
  it('persiste captura e metadados tecnicos na mesma transacao', async () => {
    const fake = fakeRepository()
    const storage = { put: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockResolvedValue(undefined) }
    const bytes = new Uint8Array([1, 2, 3])

    const result = await captureHarnessAudio(fake.repository, storage, 'owner-1', {
      filename: 'reuniao.webm', contentType: 'audio/webm', bytes, caption: 'Reuniao',
    }, { maxUploadBytes: 100 })

    expect(result).toMatchObject({
      kind: 'created',
      inboxItem: { source: 'AUDIO', status: 'TRANSCRIBING', text: 'Reuniao' },
      aiRun: { status: 'TRANSCRIBING', version: 0 },
    })
    expect(fake.jobs).toEqual([expect.objectContaining({
      type: 'audio.transcribe', ownerId: 'owner-1', aiRunId: 'run-1', step: 'TRANSCRIBING', inputVersion: 0,
      inputHash: expect.any(String),
      payload: expect.objectContaining({ storageKey: expect.stringMatching(/^inbox-audio\/owner-1\//), contentType: 'audio/webm', inputBytes: 3 }),
    })])
    expect(JSON.stringify(fake.jobs[0])).not.toContain('[1,2,3]')
  })

  /**
   * Protege: MIME, vazio e limite sao validados antes de tocar storage/DB.
   * Detecta: validacao apenas na rota, facilmente contornada por outro chamador.
   * Impacto: arquivo invalido e retido ou enviado ao provedor.
   */
  it('rejeita MIME, vazio e limite antes de persistir', async () => {
    const fake = fakeRepository()
    const storage = { put: vi.fn(), delete: vi.fn() }
    const base = { filename: 'x', caption: '' }

    expect(await captureHarnessAudio(fake.repository, storage, 'owner-1', {
      ...base, contentType: 'application/pdf', bytes: new Uint8Array([1]),
    }, { maxUploadBytes: 10 })).toEqual({ kind: 'unsupported-type' })
    expect(await captureHarnessAudio(fake.repository, storage, 'owner-1', {
      ...base, contentType: 'audio/webm', bytes: new Uint8Array(),
    }, { maxUploadBytes: 10 })).toEqual({ kind: 'invalid', issues: ['Arquivo de audio vazio.'] })
    expect(await captureHarnessAudio(fake.repository, storage, 'owner-1', {
      ...base, contentType: 'audio/webm', bytes: new Uint8Array(11),
    }, { maxUploadBytes: 10 })).toEqual({ kind: 'too-large' })
    expect(storage.put).not.toHaveBeenCalled()
    expect(fake.inboxItems).toHaveLength(0)
  })
})
