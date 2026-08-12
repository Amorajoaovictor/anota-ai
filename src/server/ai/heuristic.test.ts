import { describe, expect, it } from 'vitest'
import { HeuristicLlmProvider, HeuristicSttProvider } from './heuristic'
import { SttNotConfiguredError } from './provider'

const vistaFor = { id: 'vista', name: 'VistaFor', aliases: ['PAX'], modules: ['Loteamentos', 'Mapa'], tags: ['raster'] }
const intranet = { id: 'intranet', name: 'Intranet', aliases: [], modules: ['Acessos'], tags: [] }
const contexts: never[] = []

describe('HeuristicLlmProvider', () => {
  it('produz contexto principal e tarefa derivada no projeto identificado', async () => {
    const result = await new HeuristicLlmProvider().classify({
      text: 'PAX travando ao carregar a planta no mapa, prioridade alta', projects: [vistaFor, intranet], tasks: [], contexts,
    })

    expect(result.confidence).toBeGreaterThanOrEqual(85)
    expect(result.actions.map((action) => action.entity)).toEqual(['context', 'task'])
    expect(result.actions[0]!.data).toMatchObject({ project: { existingId: 'vista' } })
    expect(result.actions[1]!.data).toMatchObject({ kind: 'BUG', priority: 'P1', moduleName: 'Mapa' })
  })

  it('sem correspondência cai em confiança baixa e exige revisão', async () => {
    const result = await new HeuristicLlmProvider().classify({ text: 'Ligar para fornecedor', projects: [vistaFor], tasks: [], contexts })
    expect(result.confidence).toBeLessThan(60)
    expect(result.evidence[0]).toContain('Nenhum projeto')
  })

  it('não propõe tarefa duplicada, mas preserva o fato como contexto', async () => {
    const result = await new HeuristicLlmProvider().classify({
      text: 'Planta principal do mapa continua travando ao carregar', projects: [vistaFor], contexts,
      tasks: [{ id: 'task-1', title: 'Planta principal trava o carregamento do mapa', project: 'VistaFor' }],
    })
    expect(result.actions.map((action) => action.entity)).toEqual(['context'])
    expect(result.summary).toContain('Possível duplicidade')
  })

  it('recusa classificar sem projeto cadastrado', async () => {
    await expect(new HeuristicLlmProvider().classify({ text: 'x', projects: [], tasks: [], contexts }))
      .rejects.toThrow('Nenhum projeto cadastrado')
  })
})

describe('HeuristicSttProvider', () => {
  it('não inventa transcrição sem provedor real', async () => {
    await expect(new HeuristicSttProvider().transcribe({ bytes: new Uint8Array([1]), contentType: 'audio/webm' }))
      .rejects.toBeInstanceOf(SttNotConfiguredError)
  })
})
