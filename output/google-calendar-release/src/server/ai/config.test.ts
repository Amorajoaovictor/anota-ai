import { describe, expect, it } from 'vitest'
import { getAiProviders } from './config'
import { DeepSeekLlmProvider } from './deepseek'
import { GroqSttProvider } from './groq'
import { HeuristicLlmProvider, HeuristicSttProvider } from './heuristic'

describe('getAiProviders', () => {
  it('sem nada configurado, usa heurística nos dois — funciona sem chave', () => {
    const { llm, stt } = getAiProviders({})
    expect(llm).toBeInstanceOf(HeuristicLlmProvider)
    expect(stt).toBeInstanceOf(HeuristicSttProvider)
  })

  it('LLM e STT são escolhidos de forma independente', () => {
    const { llm, stt } = getAiProviders({ LLM_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'sk-x', STT_PROVIDER: 'groq', GROQ_API_KEY: 'gsk-x' })
    expect(llm).toBeInstanceOf(DeepSeekLlmProvider)
    expect(stt).toBeInstanceOf(GroqSttProvider)
  })

  it('deepseek sem chave dá erro claro em vez de silenciosamente cair pra heurística', () => {
    expect(() => getAiProviders({ LLM_PROVIDER: 'deepseek' })).toThrow('DEEPSEEK_API_KEY não configurada')
  })

  it('groq sem chave dá erro claro', () => {
    expect(() => getAiProviders({ STT_PROVIDER: 'groq' })).toThrow('GROQ_API_KEY não configurada')
  })

  it('provedor desconhecido dá erro claro', () => {
    expect(() => getAiProviders({ LLM_PROVIDER: 'gemini' })).toThrow('LLM_PROVIDER inválido')
    expect(() => getAiProviders({ STT_PROVIDER: 'whisper-local' })).toThrow('STT_PROVIDER inválido')
  })
})
