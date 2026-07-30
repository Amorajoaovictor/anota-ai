import { describe, expect, it } from 'vitest'
import { HeuristicLlmProvider, HeuristicSttProvider } from './heuristic'
import { SttNotConfiguredError } from './provider'

const vistaFor = { name: 'VistaFor', aliases: ['PAX'], modules: ['Loteamentos', 'Mapa'], tags: ['raster'] }
const intranet = { name: 'Intranet', aliases: [], modules: ['Acessos'], tags: [] }

describe('HeuristicLlmProvider', () => {
  it('classifica pelo alias do projeto e marca confiança alta com duas ou mais evidências', async () => {
    const provider = new HeuristicLlmProvider()

    const result = await provider.classify({
      text: 'PAX travando ao carregar a planta no mapa, prioridade alta',
      projects: [vistaFor, intranet],
      tasks: [],
    })

    expect(result.project).toBe('VistaFor')
    expect(result.module).toBe('Mapa')
    expect(result.confidence).toBeGreaterThanOrEqual(85)
    expect(result.evidence.length).toBeGreaterThanOrEqual(2)
    expect(result.kind).toBe('Bug')
    expect(result.priority).toBe('P1')
  })

  it('classifica por módulo isolado com confiança média', async () => {
    const provider = new HeuristicLlmProvider()

    const result = await provider.classify({
      text: 'Revisar regra do módulo de Acessos do portal interno',
      projects: [vistaFor, intranet],
      tasks: [],
    })

    expect(result.project).toBe('Intranet')
    expect(result.confidence).toBeGreaterThanOrEqual(60)
    expect(result.confidence).toBeLessThan(85)
  })

  it('sem correspondência nenhuma cai em confiança baixa e evidência explícita', async () => {
    const provider = new HeuristicLlmProvider()

    const result = await provider.classify({
      text: 'Ligar para o fornecedor amanhã de manhã',
      projects: [vistaFor, intranet],
      tasks: [],
    })

    expect(result.confidence).toBeLessThan(60)
    expect(result.evidence[0]).toContain('Nenhum projeto')
  })

  it('recusa classificar sem nenhum projeto cadastrado', async () => {
    const provider = new HeuristicLlmProvider()

    await expect(provider.classify({ text: 'Qualquer coisa', projects: [], tasks: [] }))
      .rejects.toThrow('Nenhum projeto cadastrado')
  })

  it('encontra duplicidade por sobreposição de palavras do título no mesmo projeto', async () => {
    const provider = new HeuristicLlmProvider()

    const result = await provider.classify({
      text: 'Planta principal do mapa continua travando ao carregar',
      projects: [vistaFor],
      tasks: [
        { title: 'Planta principal trava o carregamento do mapa', project: 'VistaFor' },
        { title: 'Ajustar cor do botão salvar', project: 'VistaFor' },
        { title: 'Planta principal trava o carregamento do mapa', project: 'Intranet' },
      ],
    })

    expect(result.duplicates).toEqual(['Planta principal trava o carregamento do mapa'])
  })

  it('preenche complexidade e previsão a partir do tipo/prioridade detectados', async () => {
    const provider = new HeuristicLlmProvider()

    const result = await provider.classify({
      text: 'Nova funcionalidade para exportar relatório do mapa',
      projects: [vistaFor],
      tasks: [],
    })

    expect(result.complexity).toBe('Alta')
    expect(result.forecast).toMatch(/^\d{2}\/\d{2}$/)
  })
})

describe('HeuristicSttProvider', () => {
  it('não inventa transcrição: recusa com erro claro sem provedor real', async () => {
    const provider = new HeuristicSttProvider()

    await expect(provider.transcribe({ bytes: new Uint8Array([1, 2, 3]), contentType: 'audio/webm' }))
      .rejects.toBeInstanceOf(SttNotConfiguredError)
  })
})
