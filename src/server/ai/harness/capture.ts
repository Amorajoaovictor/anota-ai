import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { enqueue } from '../../jobs/queue'
import type { StorageDriver } from '../../storage'
import { sha256 } from './hash'
import { hashAudioBytes, validateHarnessAudio } from './transcription'

const textCaptureSchema = z.object({ text: z.string() }).strict()

type HarnessCaptureRepository = {
  inboxItem: { create(args: any): Promise<any> }
  aiRun: { create(args: any): Promise<any>; update(args: any): Promise<any> }
  transcriptRevision: { create(args: any): Promise<any> }
  job: { create(args: any): Promise<any>; findUnique(args: any): Promise<any> }
  $transaction<T>(callback: (transaction: HarnessCaptureRepository) => Promise<T>): Promise<T>
}

type CaptureLimits = {
  maxCharacters: number
  countTokens(text: string): number
  organizationTimeoutMs?: number
}

export type HarnessTextCaptureResult =
  | { kind: 'created'; inboxItem: any; aiRun: any; transcript: any }
  | { kind: 'invalid'; issues: string[] }
  | { kind: 'too-large'; original: string; characters: number }

export async function captureHarnessText(
  repository: HarnessCaptureRepository,
  ownerId: string,
  rawInput: unknown,
  limits: CaptureLimits,
): Promise<HarnessTextCaptureResult> {
  const parsed = textCaptureSchema.safeParse(rawInput)
  if (!parsed.success || !parsed.data.text.trim()) return { kind: 'invalid', issues: ['Texto da entrada e obrigatorio.'] }
  const text = parsed.data.text
  const characters = Array.from(text).length
  if (characters > limits.maxCharacters) return { kind: 'too-large', original: text, characters }
  const tokenCount = limits.countTokens(text)
  if (!Number.isSafeInteger(tokenCount) || tokenCount < 0) return { kind: 'invalid', issues: ['Contador de tokens invalido.'] }

  return repository.$transaction(async (transaction) => {
    const inboxItem = await transaction.inboxItem.create({
      data: { ownerId, source: 'TEXT', status: 'ANALYZING', text },
    })
    const run = await transaction.aiRun.create({
      data: { ownerId, inboxItemId: inboxItem.id, status: 'RECEIVED', version: 0, retryable: false },
    })
    const transcriptId = randomUUID()
    const contentHash = sha256(text)
    const transcript = await transaction.transcriptRevision.create({
      data: {
        id: transcriptId,
        aiRunId: run.id,
        version: 1,
        text,
        contentHash,
        source: 'TEXT',
        inputBytes: Buffer.byteLength(text, 'utf8'),
        tokenCount,
      },
    })
    const aiRun = await transaction.aiRun.update({
      where: { id: run.id },
      data: { status: 'TRANSCRIBED', version: { increment: 1 }, activeTranscriptId: transcriptId },
    })
    await enqueue(transaction, {
      type: 'ai.organize',
      payload: { transcriptRevisionId: transcriptId },
      ownerId,
      aiRunId: run.id,
      step: 'ORGANIZING',
      inputVersion: 1,
      inputHash: contentHash,
      priority: 10,
      timeoutMs: limits.organizationTimeoutMs ?? 60_000,
      dedupeKey: `organize:${run.id}:${contentHash}:organizer-v1:configured`,
    })
    return { kind: 'created', inboxItem, aiRun, transcript }
  })
}

export type HarnessAudioUpload = {
  filename: string
  contentType: string
  bytes: Uint8Array
  caption?: string
}

export type HarnessAudioCaptureResult =
  | { kind: 'created'; inboxItem: any; aiRun: any }
  | { kind: 'invalid'; issues: string[] }
  | { kind: 'too-large' }
  | { kind: 'unsupported-type' }

export async function captureHarnessAudio(
  repository: HarnessCaptureRepository,
  storage: Pick<StorageDriver, 'put' | 'delete'>,
  ownerId: string,
  upload: HarnessAudioUpload,
  limits: { maxUploadBytes: number; transcriptionTimeoutMs?: number },
): Promise<HarnessAudioCaptureResult> {
  const validation = validateHarnessAudio(upload.bytes, upload.contentType, limits.maxUploadBytes)
  if (validation.kind === 'empty') return { kind: 'invalid', issues: ['Arquivo de audio vazio.'] }
  if (validation.kind === 'too-large') return { kind: 'too-large' }
  if (validation.kind === 'unsupported-type') return { kind: 'unsupported-type' }

  const storageKey = `inbox-audio/${ownerId}/${randomUUID()}`
  const inputHash = hashAudioBytes(upload.bytes)
  await storage.put(storageKey, upload.bytes)
  try {
    return await repository.$transaction(async (transaction) => {
      const inboxItem = await transaction.inboxItem.create({
        data: {
          ownerId,
          source: 'AUDIO',
          status: 'TRANSCRIBING',
          text: upload.caption?.trim() ?? '',
        },
      })
      const aiRun = await transaction.aiRun.create({
        data: {
          ownerId,
          inboxItemId: inboxItem.id,
          status: 'TRANSCRIBING',
          version: 0,
          retryable: false,
        },
      })
      await enqueue(transaction, {
        type: 'audio.transcribe',
        payload: { storageKey, contentType: validation.contentType, inputBytes: upload.bytes.byteLength },
        dedupeKey: `${aiRun.id}:TRANSCRIBING:0:${inputHash}`,
        ownerId,
        aiRunId: aiRun.id,
        step: 'TRANSCRIBING',
        inputVersion: 0,
        inputHash,
        priority: 10,
        timeoutMs: limits.transcriptionTimeoutMs ?? 5 * 60_000,
      })
      return { kind: 'created', inboxItem, aiRun }
    })
  } catch (error) {
    await storage.delete(storageKey).catch(() => undefined)
    throw error
  }
}
