import { describe, expect, it, vi } from 'vitest'
import type { JobRecord } from '../../jobs/queue'
import { hashAudioBytes, processHarnessTranscription, sweepOrphanAudio, validateHarnessAudio } from './transcription'

const bytes = new Uint8Array([1, 2, 3, 4])

function transcriptionJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: 'job-stt-1', type: 'audio.transcribe',
    payload: { storageKey: 'inbox-audio/owner-1/audio-1', contentType: 'audio/webm', inputBytes: bytes.byteLength },
    status: 'RUNNING', attempts: 1, maxAttempts: 3,
    runAt: new Date('2026-07-31T12:00:00.000Z'), lockedAt: new Date('2026-07-31T12:00:00.000Z'),
    lockedBy: 'worker-1', lastError: null, dedupeKey: 'run-1:TRANSCRIBING:0',
    ownerId: 'owner-1', aiRunId: 'run-1', step: 'TRANSCRIBING', inputVersion: 0,
    inputHash: hashAudioBytes(bytes), priority: 10,
    leaseExpiresAt: new Date('2026-07-31T12:05:00.000Z'), heartbeatAt: new Date('2026-07-31T12:00:00.000Z'),
    timeoutMs: 60_000, cancelledAt: null,
    ...overrides,
  }
}

function createTranscriptionFake(runOverrides: Record<string, unknown> = {}) {
  const run: any = { id: 'run-1', ownerId: 'owner-1', status: 'TRANSCRIBING', version: 0, discardedAt: null, ...runOverrides }
  const transcripts: any[] = []
  const jobs: any[] = []
  const attempts: any[] = []
  const repository: any = {
    aiRun: {
      async findFirst({ where }: any) {
        return run.id === where.id && run.ownerId === where.ownerId ? { ...run } : null
      },
      async updateMany({ where, data }: any) {
        if (run.id !== where.id || run.ownerId !== where.ownerId || run.version !== where.version) return { count: 0 }
        if (typeof where.status === 'string' && run.status !== where.status) return { count: 0 }
        if (where.discardedAt === null && run.discardedAt !== null) return { count: 0 }
        if (data.version?.increment) run.version += data.version.increment
        Object.assign(run, Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'version')))
        return { count: 1 }
      },
    },
    transcriptRevision: {
      findFirst: vi.fn().mockResolvedValue(null),
      async create({ data }: any) {
        const transcript = { id: data.id ?? `transcript-${transcripts.length + 1}`, ...data }
        transcripts.push(transcript)
        return transcript
      },
    },
    job: {
      async create({ data }: any) {
        const job = { id: `job-${jobs.length + 1}`, status: 'PENDING', attempts: 0, ...data }
        jobs.push(job)
        return job
      },
      findUnique: vi.fn().mockResolvedValue(null),
    },
    aiCallAttempt: {
      async create({ data }: any) {
        attempts.push(data)
        return data
      },
    },
  }
  repository.$transaction = (callback: (transaction: any) => Promise<unknown>) => callback(repository)
  return { repository, run, transcripts, jobs, attempts }
}

function jobContext() {
  return {
    signal: new AbortController().signal,
    heartbeat: vi.fn().mockResolvedValue(true),
    isCancelled: vi.fn().mockResolvedValue(false),
  }
}

describe('validacao de audio do harness', () => {
  /**
   * Protege: somente formatos explicitamente suportados e arquivo nao vazio chegam ao STT.
   * Detecta: aceitar qualquer audio/*, MIME arbitrario ou zero bytes.
   * Impacto: falhas caras no provedor e entrada presa sem mensagem acionavel.
   */
  it('aceita MIME permitido e rejeita MIME invalido ou arquivo vazio', () => {
    expect(validateHarnessAudio(bytes, 'audio/webm', 10)).toEqual({ kind: 'valid', contentType: 'audio/webm' })
    expect(validateHarnessAudio(bytes, 'audio/not-real', 10)).toEqual({ kind: 'unsupported-type' })
    expect(validateHarnessAudio(new Uint8Array(), 'audio/webm', 10)).toEqual({ kind: 'empty' })
  })

  /**
   * Protege: limite e rejeitado sem truncar bytes.
   * Detecta: slice silencioso para caber no upload/provedor.
   * Impacto: decisoes no fim do audio somem da transcricao.
   */
  it('rejeita audio acima do limite sem alterar conteudo', () => {
    expect(validateHarnessAudio(bytes, 'audio/webm', 3)).toEqual({ kind: 'too-large' })
    expect(bytes).toEqual(new Uint8Array([1, 2, 3, 4]))
  })
})

describe('transcricao isolada do harness', () => {
  /**
   * H16 protege: sucesso cria TranscriptRevision, encadeia organizacao por ID/hash e apaga audio.
   * Detecta: texto ficando apenas na inbox, payload carregando conteudo grande ou arquivo orfao.
   * Impacto: reload perde rastreabilidade e dado sensivel fica retido.
   */
  it('persiste revisao, enfileira organizacao e exclui audio no sucesso', async () => {
    const fake = createTranscriptionFake()
    const storage = { read: vi.fn().mockResolvedValue(bytes), delete: vi.fn().mockResolvedValue(undefined) }
    const provider = { transcribe: vi.fn().mockResolvedValue({ text: 'Decisao transcrita.' }) }
    const metrics = { increment: vi.fn(), observe: vi.fn() }

    const result = await processHarnessTranscription(
      { repository: fake.repository, storage, provider, providerName: 'groq', model: 'whisper', metrics },
      transcriptionJob(), jobContext(),
    )

    expect(result).toMatchObject({ kind: 'transcribed', transcript: { text: 'Decisao transcrita.', source: 'STT' } })
    expect(fake.run).toMatchObject({ status: 'TRANSCRIBED', version: 1 })
    expect(fake.transcripts).toHaveLength(1)
    expect(fake.jobs[0]).toMatchObject({
      type: 'ai.organize', ownerId: 'owner-1', aiRunId: 'run-1', step: 'ORGANIZING', inputVersion: 1,
      payload: { transcriptRevisionId: fake.transcripts[0].id },
    })
    expect(JSON.stringify(fake.jobs[0])).not.toContain('Decisao transcrita')
    expect(storage.delete).toHaveBeenCalledWith('inbox-audio/owner-1/audio-1')
    expect(metrics.observe).toHaveBeenCalledWith('harness.transcription.latency_ms', expect.any(Number), expect.any(Object))
  })

  /**
   * Protege: falha retryable preserva audio e mesma versao/hash para proxima tentativa.
   * Detecta: cleanup executado na primeira falha ou retry remontando entrada.
   * Impacto: usuario perde audio antes de esgotar recuperacao automatica.
   */
  it('preserva audio em falha retryable e usa mesmo snapshot ao reprocessar', async () => {
    const fake = createTranscriptionFake()
    const storage = { read: vi.fn().mockResolvedValue(bytes), delete: vi.fn().mockResolvedValue(undefined) }
    const provider = { transcribe: vi.fn().mockRejectedValue(new Error('503')) }

    await expect(processHarnessTranscription(
      { repository: fake.repository, storage, provider, providerName: 'groq', model: 'whisper' },
      transcriptionJob({ attempts: 1, maxAttempts: 3 }), jobContext(),
    )).rejects.toThrow('503')

    expect(storage.delete).not.toHaveBeenCalled()
    expect(fake.run).toMatchObject({ status: 'TRANSCRIBING', version: 0 })
    expect(fake.attempts[0]).toMatchObject({ inputHash: hashAudioBytes(bytes), technicalResult: 'RETRY' })
  })

  /**
   * H16 protege: falha final apaga audio e fecha run sem retry impossivel.
   * Detecta: arquivo retido indefinidamente depois do maxAttempts.
   * Impacto: quebra politica de privacidade e aumenta storage orfao.
   */
  it('apaga audio e marca run na falha final', async () => {
    const fake = createTranscriptionFake()
    const storage = { read: vi.fn().mockResolvedValue(bytes), delete: vi.fn().mockResolvedValue(undefined) }
    const provider = { transcribe: vi.fn().mockRejectedValue(new Error('provedor indisponivel')) }

    await expect(processHarnessTranscription(
      { repository: fake.repository, storage, provider, providerName: 'groq', model: 'whisper' },
      transcriptionJob({ attempts: 3, maxAttempts: 3 }), jobContext(),
    )).rejects.toThrow('provedor indisponivel')

    expect(storage.delete).toHaveBeenCalledWith('inbox-audio/owner-1/audio-1')
    expect(fake.run).toMatchObject({ status: 'FAILED', failedStep: 'TRANSCRIBING', retryable: false })
  })

  /**
   * H05 protege: reprocessamento tardio nao chama provedor nem cria segunda revisao.
   * Detecta: worker repetindo job concluido depois de lease perdida.
   * Impacto: custo duplicado e revisao ativa sobrescrita.
   */
  it('descarta reprocessamento quando run ja avancou', async () => {
    const fake = createTranscriptionFake({ status: 'TRANSCRIBED', version: 1 })
    const storage = { read: vi.fn(), delete: vi.fn().mockResolvedValue(undefined) }
    const provider = { transcribe: vi.fn() }

    const result = await processHarnessTranscription(
      { repository: fake.repository, storage, provider, providerName: 'groq', model: 'whisper' },
      transcriptionJob(), jobContext(),
    )

    expect(result).toEqual({ kind: 'stale' })
    expect(provider.transcribe).not.toHaveBeenCalled()
    expect(fake.transcripts).toHaveLength(0)
  })
})

describe('sweeper de audio temporario', () => {
  /**
   * H16 protege: orfao com mais de 24h e removido sem tocar audio recente ou job ativo.
   * Detecta: sweeper apagando upload em processamento ou ignorando vazamento antigo.
   * Impacto: perda de entrada ativa ou retencao indevida.
   */
  it('remove somente orfaos vencidos', async () => {
    const now = new Date('2026-07-31T15:00:00.000Z')
    const storage = {
      list: vi.fn().mockResolvedValue([
        { key: 'inbox-audio/owner-1/orfao', updatedAt: new Date('2026-07-29T12:00:00.000Z') },
        { key: 'inbox-audio/owner-1/ativo', updatedAt: new Date('2026-07-29T12:00:00.000Z') },
        { key: 'inbox-audio/owner-1/recente', updatedAt: new Date('2026-07-31T14:00:00.000Z') },
      ]),
      delete: vi.fn().mockResolvedValue(undefined),
    }
    const repository: any = {
      job: { findMany: vi.fn().mockResolvedValue([{ payload: { storageKey: 'inbox-audio/owner-1/ativo' } }]) },
    }

    const result = await sweepOrphanAudio(repository, storage, { now, maxAgeMs: 24 * 60 * 60_000 })

    expect(result).toEqual({ scanned: 3, deleted: 1, failed: 0 })
    expect(storage.delete).toHaveBeenCalledTimes(1)
    expect(storage.delete).toHaveBeenCalledWith('inbox-audio/owner-1/orfao')
  })
})
