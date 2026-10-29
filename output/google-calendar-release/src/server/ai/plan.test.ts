import { describe, expect, it } from 'vitest'
import { aiPlanSchema, orderAiPlanActions } from './plan'

const fact = (id: string, title: string) => ({
  id,
  entity: 'context',
  operation: 'create',
  dependsOn: [],
  confidence: 91,
  evidence: ['Informado explicitamente no áudio.'],
  data: {
    project: { existingId: 'project-1' },
    category: 'FACT',
    title,
    content: `${title}.`,
  },
})

describe('contrato do plano multi-entidade da IA', () => {
  it('converte confiança fracionária do modelo para porcentagem inteira', () => {
    const result = aiPlanSchema.parse({
      summary: 'Plano em escala fracionária.',
      confidence: 0.91,
      evidence: ['Confiança retornada entre zero e um.'],
      actions: [{ ...fact('context-confidence', 'Fato confirmado'), confidence: 0.89 }],
    })

    expect(result.confidence).toBe(91)
    expect(result.actions[0]!.confidence).toBe(89)
  })

  it('preserva vários fatos como contextos independentes na mesma proposta', () => {
    const result = aiPlanSchema.parse({
      summary: 'Regras e tarefas extraídas da reunião.',
      confidence: 92,
      evidence: ['O áudio contém duas afirmações independentes.'],
      actions: [fact('context-rule', 'Toda publicação exige homologação'), fact('context-vocab', 'PAX significa VistaFor')],
    })

    expect(result.actions).toHaveLength(2)
    expect(result.actions.map((action) => action.id)).toEqual(['context-rule', 'context-vocab'])
  })

  it('ordena projeto antes de contexto e tarefa que usam o projeto novo', () => {
    const plan = aiPlanSchema.parse({
      summary: 'Novo projeto com contexto e tarefa.',
      confidence: 88,
      evidence: ['Projeto e demanda foram nomeados.'],
      actions: [
        {
          ...fact('context-1', 'O sistema usa mapa vetorial'),
          dependsOn: ['project-1'],
          data: { ...fact('x', 'x').data, project: { actionId: 'project-1' } },
        },
        {
          id: 'task-1', entity: 'task', operation: 'create', dependsOn: ['project-1'], confidence: 88,
          evidence: ['Pedido explícito para preparar ambiente.'],
          data: { project: { actionId: 'project-1' }, title: 'Preparar ambiente' },
        },
        {
          id: 'project-1', entity: 'project', operation: 'create', dependsOn: [], confidence: 95,
          evidence: ['Nome do projeto informado.'], data: { name: 'Novo Mapa' },
        },
      ],
    })

    expect(orderAiPlanActions(plan).map((action) => action.id)).toEqual(['project-1', 'context-1', 'task-1'])
  })

  it('recusa entidade usuário mesmo quando o modelo tenta produzi-la', () => {
    const result = aiPlanSchema.safeParse({
      summary: 'Tentativa inválida.', confidence: 90, evidence: ['x'],
      actions: [{ id: 'user-1', entity: 'user', operation: 'create', dependsOn: [], confidence: 90, evidence: ['x'], data: { name: 'João' } }],
    })

    expect(result.success).toBe(false)
  })

  it('recusa ids repetidos, dependência inexistente e ciclo antes de qualquer escrita', () => {
    const duplicate = aiPlanSchema.safeParse({
      summary: 'x', confidence: 80, evidence: ['x'], actions: [fact('same', 'A'), fact('same', 'B')],
    })
    expect(duplicate.success).toBe(false)

    const missing = aiPlanSchema.parse({
      summary: 'x', confidence: 80, evidence: ['x'],
      actions: [{ ...fact('a', 'A'), dependsOn: ['missing'] }],
    })
    expect(() => orderAiPlanActions(missing)).toThrow('dependência inexistente')

    const cyclic = aiPlanSchema.parse({
      summary: 'x', confidence: 80, evidence: ['x'],
      actions: [{ ...fact('a', 'A'), dependsOn: ['b'] }, { ...fact('b', 'B'), dependsOn: ['a'] }],
    })
    expect(() => orderAiPlanActions(cyclic)).toThrow('ciclo')
  })
})
