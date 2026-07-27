import { describe, expect, it } from 'vitest'
import { isValidRunnerToken } from './auth'

describe('isValidRunnerToken', () => {
  it('recusa quando não há token configurado', () => {
    expect(isValidRunnerToken(null, 'token-do-worker')).toBe(false)
    expect(isValidRunnerToken('', 'token-do-worker')).toBe(false)
  })

  it('recusa quando a requisição não envia token', () => {
    expect(isValidRunnerToken('token-do-worker', null)).toBe(false)
    expect(isValidRunnerToken('token-do-worker', '')).toBe(false)
  })

  it('recusa comprimentos diferentes sem estourar na comparação', () => {
    expect(isValidRunnerToken('token-do-worker', 'token')).toBe(false)
    expect(isValidRunnerToken('token', 'token-do-worker')).toBe(false)
  })

  it('recusa token de mesmo comprimento e conteúdo diferente', () => {
    expect(isValidRunnerToken('token-do-worker', 'token-do-invaso')).toBe(false)
  })

  it('aceita token idêntico', () => {
    expect(isValidRunnerToken('token-do-worker', 'token-do-worker')).toBe(true)
  })

  it('compara os bytes, não os caracteres', () => {
    // 'ç' ocupa dois bytes em UTF-8: comparar por comprimento de string aceitaria valores diferentes.
    expect(isValidRunnerToken('senha-de-execucao', 'senha-de-execuçao')).toBe(false)
  })
})
