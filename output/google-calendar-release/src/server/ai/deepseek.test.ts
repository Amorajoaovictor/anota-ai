import { describe, expect, it, vi } from 'vitest'
import { DeepSeekLlmProvider } from './deepseek'

const input = {
  text: 'No PAX decidimos homologar antes de publicar. Criar tarefa para revisar deploy.',
  projects: [{ id: 'project-vista', name: 'VistaFor', aliases: ['PAX'], modules: ['Mapa'], tags: ['raster'] }],
  tasks: [{ id: 'task-old', title: 'Raster sobrepõe lotes', project: 'VistaFor' }],
  contexts: [{ id: 'context-old', projectId: 'project-vista', project: 'VistaFor', category: 'FACT', title: 'Stack', content: 'Usa Next.js.' }],
}

const validPlan = {
  summary: 'Uma decisão e uma tarefa para o VistaFor.',
  confidence: 92,
  evidence: ['PAX é alias do VistaFor.', 'A decisão foi declarada.'],
  actions: [
    {
      id: 'context-decision', entity: 'context', operation: 'create', dependsOn: [], confidence: 95,
      evidence: ['Decidimos homologar antes de publicar.'],
      data: { project: { existingId: 'project-vista' }, category: 'DECISION', title: 'Homologação obrigatória', content: 'Toda publicação passa por homologação.' },
    },
    {
      id: 'task-review', entity: 'task', operation: 'create', dependsOn: [], confidence: 90,
      evidence: ['Criar tarefa para revisar deploy.'],
      data: { project: { existingId: 'project-vista' }, title: 'Revisar deploy', kind: 'TASK', priority: 'P2' },
    },
  ],
}

function chatResponse(content: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }),
    text: async () => JSON.stringify(content),
  } as Response
}

describe('DeepSeekLlmProvider', () => {
  it('devolve proposta multi-entidade validada e envia contextos reais', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(chatResponse(validPlan))
    const result = await new DeepSeekLlmProvider({ apiKey: 'sk-teste', fetchImpl }).classify(input)

    expect(result.actions.map((action) => action.entity)).toEqual(['context', 'task'])
    const body = JSON.parse((fetchImpl.mock.calls[0]![1] as RequestInit).body as string)
    expect(JSON.parse(body.messages[1].content)).toMatchObject({ text: input.text, contexts: input.contexts })
  })

  it('permite projeto novo e referência por actionId ordenável', async () => {
    const plan = {
      ...validPlan,
      actions: [
        { id: 'new-project', entity: 'project', operation: 'create', dependsOn: [], confidence: 90, evidence: ['Nome explícito.'], data: { name: 'Atlas' } },
        { ...validPlan.actions[0], dependsOn: ['new-project'], data: { ...validPlan.actions[0].data, project: { actionId: 'new-project' } } },
      ],
    }
    const result = await new DeepSeekLlmProvider({ apiKey: 'x', fetchImpl: vi.fn().mockResolvedValue(chatResponse(plan)) }).classify(input)
    expect(result.actions).toHaveLength(2)
  })

  it('recusa usuário e referências reais inexistentes', async () => {
    const userPlan = { ...validPlan, actions: [{ id: 'u', entity: 'user', operation: 'create', dependsOn: [], confidence: 90, evidence: ['x'], data: { name: 'João' } }] }
    await expect(new DeepSeekLlmProvider({ apiKey: 'x', fetchImpl: vi.fn().mockResolvedValue(chatResponse(userPlan)) }).classify(input)).rejects.toThrow('formato esperado')

    const unknownProject = structuredClone(validPlan)
    ;(unknownProject.actions[0]!.data.project as { existingId: string }).existingId = 'project-alheio'
    await expect(new DeepSeekLlmProvider({ apiKey: 'x', fetchImpl: vi.fn().mockResolvedValue(chatResponse(unknownProject)) }).classify(input)).rejects.toThrow('projeto inexistente')
  })

  it('normaliza formato comum do modelo sem cair no backoff da fila', async () => {
    const loosePlan = {
      summary: 'Decisão e vocabulário.',
      confidence: '91',
      evidence: 'PAX foi citado explicitamente.',
      actions: [
        {
          id: 'decision-1', type: 'create', operation: 'create', confidence: '93', evidence: 'Ficou decidido no áudio.',
          data: { entity: 'decision', project: { existingId: 'project-vista' }, title: 'Homologar primeiro', content: 'Publicar somente após homologação.' },
        },
        {
          id: 'vocab-1', type: 'create', operation: 'create', dependsOn: '', confidence: 90, evidence: 'O significado foi explicado.',
          data: { category: 'vocabulary', project: 'VistaFor', title: 'PAX', content: 'PAX significa VistaFor.' },
        },
        {
          id: 'task-1', type: 'create', operation: 'create', confidence: 89, evidence: 'Pedido explícito.',
          data: { entity: 'task', projectId: 'project-vista', title: 'Revisar deploy', tags: 'deploy, homologação', contexts: ['Deploy precisa de homologação.'] },
        },
      ],
    }

    const result = await new DeepSeekLlmProvider({ apiKey: 'x', fetchImpl: vi.fn().mockResolvedValue(chatResponse(loosePlan)) }).classify(input)

    expect(result.evidence).toEqual(['PAX foi citado explicitamente.'])
    expect(result.actions).toMatchObject([
      { entity: 'context', operation: 'create', dependsOn: [], evidence: ['Ficou decidido no áudio.'], data: { category: 'DECISION' } },
      { entity: 'context', operation: 'create', dependsOn: [], evidence: ['O significado foi explicado.'], data: { project: { existingId: 'project-vista' }, category: 'VOCABULARY' } },
      { entity: 'task', operation: 'create', dependsOn: [], data: { project: { existingId: 'project-vista' }, tags: ['deploy', 'homologação'] } },
      { entity: 'context', operation: 'create', dependsOn: ['task-1'], data: { project: { existingId: 'project-vista' }, task: { actionId: 'task-1' }, category: 'FACT', content: 'Deploy precisa de homologação.' } },
    ])
  })

  it('recusa JSON inválido e propaga falha HTTP', async () => {
    const invalidFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'não-json' } }] }) } as Response)
    await expect(new DeepSeekLlmProvider({ apiKey: 'x', fetchImpl: invalidFetch }).classify(input)).rejects.toThrow('JSON válido')

    await expect(new DeepSeekLlmProvider({ apiKey: 'x', fetchImpl: vi.fn().mockResolvedValue(chatResponse({ error: 'limit' }, 429)) }).classify(input)).rejects.toThrow('429')
  })
})
