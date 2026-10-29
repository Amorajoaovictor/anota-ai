import { suggestComplexity, type EntryKind, type Priority } from '../../domain'
import {
  SttNotConfiguredError,
  type ClassificationInput,
  type ClassificationProject,
  type ClassificationResult,
  type ClassificationTask,
  type LlmProvider,
  type SttInput,
  type SttProvider,
  type SttResult,
} from './provider'

const STOPWORDS = new Set([
  'para', 'com', 'uma', 'umas', 'uns', 'que', 'nao', 'dos', 'das', 'por', 'em', 'no', 'na', 'ao',
  'se', 'ja', 'mais', 'menos', 'muito', 'como', 'este', 'esta', 'esse', 'essa', 'isso', 'sobre',
  'quando', 'porque', 'pelo', 'pela', 'onde', 'ainda', 'esta', 'foi', 'ser', 'tem', 'seu', 'sua',
])

/**
 * Sem provedor real de IA (Fase 4 sem chave configurada), esta é a classificação
 * de verdade que roda hoje: casa o texto contra projeto/alias/módulo/tag reais do
 * banco em vez de dois casos fixos. Confiança segue as faixas do PRD 9.7.
 */
export class HeuristicLlmProvider implements LlmProvider {
  async classify(input: ClassificationInput): Promise<ClassificationResult> {
    if (input.projects.length === 0) {
      throw new Error('Nenhum projeto cadastrado para classificar a entrada.')
    }

    const normalizedText = normalize(input.text)
    const candidates = input.projects
      .map((project) => ({ project, match: matchProject(project, normalizedText) }))
      .sort((left, right) => right.match.score - left.match.score)

    const best = candidates[0]!
    const kind = detectKind(normalizedText)
    const priority = detectPriority(normalizedText)
    const complexity = suggestComplexity(kind, priority)
    const duplicates = best.match.score > 0 ? findDuplicates(normalizedText, best.project.name, input.tasks) : []

    const summary = best.match.score > 0
        ? `Entrada associada a ${best.project.name} por correspondência de vocabulário do projeto.`
        : 'Nenhum projeto teve correspondência clara — confirme antes de aprovar.'
    const context = {
      id: 'context-1' as const,
      entity: 'context' as const,
      operation: 'create' as const,
      dependsOn: [],
      confidence: best.match.confidence,
      evidence: best.match.evidence,
      data: {
        project: { existingId: best.project.id },
        category: kind === 'Decisão' ? 'DECISION' as const : 'FACT' as const,
        title: toTitle(input.text),
        content: input.text.trim(),
      },
    }
    const task = {
      id: 'task-1' as const,
      entity: 'task' as const,
      operation: 'create' as const,
      dependsOn: [],
      confidence: best.match.confidence,
      evidence: best.match.evidence,
      data: {
        project: { existingId: best.project.id },
        title: toTitle(input.text),
        description: defaultAction(kind),
        moduleName: best.match.module,
        kind: toDbKind(kind),
        priority,
        complexity: complexity === 'Baixa' ? 1 as const : complexity === 'Média' ? 2 as const : 3 as const,
      },
    }

    return {
      summary: duplicates.length ? `${summary} Possível duplicidade: ${duplicates.join(', ')}.` : summary,
      confidence: best.match.confidence,
      evidence: best.match.evidence,
      actions: duplicates.length ? [context] : [context, task],
    }
  }
}

export class HeuristicSttProvider implements SttProvider {
  async transcribe(_input: SttInput): Promise<SttResult> {
    throw new SttNotConfiguredError()
  }
}

function matchProject(project: ClassificationProject, normalizedText: string) {
  const evidence: string[] = []
  let module: string | undefined
  let matchedCount = 0

  if (containsTerm(normalizedText, project.name)) {
    evidence.push(`Texto menciona "${project.name}", nome do projeto.`)
    matchedCount += 1
  }
  project.aliases.forEach((alias) => {
    if (containsTerm(normalizedText, alias)) {
      evidence.push(`"${alias}" está cadastrado como alias de ${project.name}.`)
      matchedCount += 1
    }
  })
  project.modules.forEach((mod) => {
    if (containsTerm(normalizedText, mod)) {
      evidence.push(`Vocabulário coincide com o módulo ${mod} de ${project.name}.`)
      module = module ?? mod
      matchedCount += 1
    }
  })
  project.tags.forEach((tag) => {
    if (containsTerm(normalizedText, tag)) {
      evidence.push(`Texto menciona a etiqueta "${tag}" usada em ${project.name}.`)
      matchedCount += 1
    }
  })

  if (matchedCount === 0) {
    return {
      score: 0,
      confidence: 35,
      module: undefined,
      evidence: ['Nenhum projeto teve correspondência clara no texto.', 'Classificação usa contexto recente como hipótese.'],
    }
  }

  const confidence = Math.min(97, 60 + matchedCount * 15)
  return { score: matchedCount, confidence, module, evidence }
}

function containsTerm(normalizedText: string, term: string) {
  const normalizedTerm = normalize(term)
  return normalizedTerm.length > 1 && normalizedText.includes(normalizedTerm)
}

function detectKind(normalizedText: string): EntryKind {
  if (/\b(bug|trava|travando|erro|falha|quebrou)\b/.test(normalizedText)) return 'Bug'
  if (/\b(decisao|decidimos|ficou definido)\b/.test(normalizedText)) return 'Decisão'
  if (/\b(ideia|futuramente|no futuro)\b/.test(normalizedText)) return 'Ideia futura'
  if (normalizedText.trim().endsWith('?') || /\b(duvida|pergunta)\b/.test(normalizedText)) return 'Pergunta'
  if (/\b(solicitacao|solicitou|pediu externamente|fornecedor pediu)\b/.test(normalizedText)) return 'Solicitação externa'
  if (/\b(melhorar|melhoria|otimizar|otimizacao)\b/.test(normalizedText)) return 'Melhoria'
  if (/\b(nova funcionalidade|funcionalidade nova|criar funcionalidade)\b/.test(normalizedText)) return 'Funcionalidade'
  return 'Tarefa'
}

function detectPriority(normalizedText: string): Priority {
  if (/\b(critico|critica|urgente|imediat[ao])\b/.test(normalizedText)) return 'P0'
  if (/\b(prioridade alta|alta prioridade)\b/.test(normalizedText)) return 'P1'
  if (/\b(prioridade baixa|baixa prioridade|sem pressa)\b/.test(normalizedText)) return 'P3'
  return 'P2'
}

function defaultAction(kind: EntryKind): string {
  switch (kind) {
    case 'Bug': return 'Reproduzir o problema e revisar a causa antes de corrigir.'
    case 'Decisão': return 'Registrar participantes e consequências da decisão.'
    case 'Pergunta': return 'Levar a pergunta para quem pode responder e registrar o retorno.'
    case 'Ideia futura': return 'Avaliar viabilidade antes de priorizar.'
    case 'Solicitação externa': return 'Confirmar prazo e responsável com quem solicitou.'
    default: return 'Detalhar e validar a próxima ação com o responsável.'
  }
}

function toDbKind(kind: EntryKind) {
  const values = {
    Tarefa: 'TASK', Bug: 'BUG', Melhoria: 'IMPROVEMENT', Funcionalidade: 'FEATURE', Decisão: 'DECISION',
    'Solicitação externa': 'EXTERNAL_REQUEST', 'Ideia futura': 'FUTURE_IDEA', Pergunta: 'QUESTION',
  } as const
  return values[kind]
}

function toTitle(text: string): string {
  const clean = text.trim()
  return clean.length > 72 ? `${clean.slice(0, 69)}...` : clean
}

function findDuplicates(normalizedText: string, projectName: string, tasks: ClassificationTask[]): string[] {
  const textTokens = tokenize(normalizedText)
  if (!textTokens.size) return []

  return tasks
    .filter((task) => task.project === projectName)
    .map((task) => ({ task, overlap: intersectionSize(textTokens, tokenize(normalize(task.title))) }))
    .filter((entry) => entry.overlap > 0)
    .sort((left, right) => right.overlap - left.overlap)
    .slice(0, 3)
    .map((entry) => entry.task.title)
}

function tokenize(normalizedText: string): Set<string> {
  return new Set(
    normalizedText
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 4 && !STOPWORDS.has(word)),
  )
}

function intersectionSize(left: Set<string>, right: Set<string>): number {
  let count = 0
  left.forEach((word) => { if (right.has(word)) count += 1 })
  return count
}

const DIACRITICS = /[̀-ͯ]/g

function normalize(value: string): string {
  return value
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(DIACRITICS, '')
}
