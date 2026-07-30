import { DeepSeekLlmProvider } from './deepseek'
import { GroqSttProvider } from './groq'
import { HeuristicLlmProvider, HeuristicSttProvider } from './heuristic'
import type { LlmProvider, SttProvider } from './provider'

export type AiProviders = { llm: LlmProvider; stt: SttProvider }

export function readAiEnvironment(): Record<string, string | undefined> {
  return {
    LLM_PROVIDER: process.env.LLM_PROVIDER,
    STT_PROVIDER: process.env.STT_PROVIDER,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_STT_MODEL: process.env.GROQ_STT_MODEL,
  }
}

/**
 * Único ponto de troca de provedor (mesmo padrão de `storage/config.ts`). LLM e STT
 * são escolhidos independentemente — dá pra usar DeepSeek pra classificar e Groq
 * pra transcrever ao mesmo tempo, sem os dois precisarem ser o mesmo fornecedor.
 */
export function getAiProviders(environment: Record<string, string | undefined>): AiProviders {
  return { llm: buildLlm(environment), stt: buildStt(environment) }
}

function buildLlm(environment: Record<string, string | undefined>): LlmProvider {
  const provider = environment.LLM_PROVIDER?.trim() || 'heuristic'
  if (provider === 'heuristic') return new HeuristicLlmProvider()
  if (provider === 'deepseek') {
    return new DeepSeekLlmProvider({
      apiKey: requireKey('DEEPSEEK_API_KEY', environment),
      model: environment.DEEPSEEK_MODEL?.trim() || undefined,
    })
  }
  throw new Error(`LLM_PROVIDER inválido: ${provider}. Use "heuristic" ou "deepseek".`)
}

function buildStt(environment: Record<string, string | undefined>): SttProvider {
  const provider = environment.STT_PROVIDER?.trim() || 'none'
  if (provider === 'none') return new HeuristicSttProvider()
  if (provider === 'groq') {
    return new GroqSttProvider({
      apiKey: requireKey('GROQ_API_KEY', environment),
      model: environment.GROQ_STT_MODEL?.trim() || undefined,
    })
  }
  throw new Error(`STT_PROVIDER inválido: ${provider}. Use "none" ou "groq".`)
}

function requireKey(name: string, environment: Record<string, string | undefined>): string {
  const value = environment[name]?.trim()
  if (!value) throw new Error(`${name} não configurada — defina no .env para usar este provedor.`)
  return value
}
