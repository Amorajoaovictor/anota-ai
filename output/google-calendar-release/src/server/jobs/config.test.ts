import { describe, expect, it } from 'vitest'
import { isValidRunnerToken } from './auth'
import { getJobsConfig } from './config'

describe('configuração da fila', () => {
  it('usa padrões quando o ambiente está vazio', () => {
    expect(getJobsConfig({})).toEqual({
      runnerToken: null,
      batchSize: 10,
      lockTimeoutMs: 300000,
      pollIntervalMs: 1000,
    })
  })

  it('ignora token curto demais para servir de segredo', () => {
    expect(getJobsConfig({ JOBS_RUNNER_TOKEN: 'curto' }).runnerToken).toBeNull()
    expect(getJobsConfig({ JOBS_RUNNER_TOKEN: 'token-com-16-ou-mais' }).runnerToken).toBe('token-com-16-ou-mais')
  })

  it('descarta números inválidos e mantém o padrão', () => {
    expect(getJobsConfig({ JOBS_BATCH_SIZE: '-3', JOBS_LOCK_TIMEOUT_MS: 'abc' })).toMatchObject({
      batchSize: 10,
      lockTimeoutMs: 300000,
    })
  })

  it('só aceita o token exato', () => {
    expect(isValidRunnerToken('token-com-16-ou-mais', 'token-com-16-ou-mais')).toBe(true)
    expect(isValidRunnerToken('token-com-16-ou-mais', 'token-com-16-ou-mai')).toBe(false)
    expect(isValidRunnerToken('token-com-16-ou-mais', null)).toBe(false)
    expect(isValidRunnerToken(null, 'token-com-16-ou-mais')).toBe(false)
  })
})
