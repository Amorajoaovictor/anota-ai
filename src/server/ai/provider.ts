import type { AiPlan } from './plan'

/**
 * Contrato plugável do agente contextual (PRD 8.1 e 25.4: modelo substituível,
 * nunca dependência fixa do domínio). `HeuristicLlmProvider`/`HeuristicSttProvider`
 * são a implementação padrão sem rede; um provedor real entra depois só trocando
 * `getAiProviders` em `config.ts`, sem mexer em quem os chama.
 */

export type ClassificationProject = {
  id: string
  name: string
  aliases: string[]
  modules: string[]
  tags: string[]
}

export type ClassificationTask = {
  id: string
  title: string
  project: string
}

export type ClassificationContext = {
  id: string
  projectId: string
  project: string
  category: string
  title: string
  content: string
}

export type ClassificationInput = {
  text: string
  projects: ClassificationProject[]
  tasks: ClassificationTask[]
  contexts: ClassificationContext[]
}

export type ClassificationResult = AiPlan

export type LlmProvider = {
  classify(input: ClassificationInput): Promise<ClassificationResult>
}

export type SttInput = { bytes: Uint8Array; contentType: string }
export type SttResult = { text: string }

export type SttProvider = {
  transcribe(input: SttInput): Promise<SttResult>
}

export class SttNotConfiguredError extends Error {
  constructor() {
    super('Nenhum provedor de transcrição configurado. Defina STT_PROVIDER=groq e GROQ_API_KEY para transcrever áudio.')
    this.name = 'SttNotConfiguredError'
  }
}
