import { describe, expect, it, vi } from 'vitest'
import { DeepSeekLlmProvider } from './deepseek'

const input = {
  text: 'Planta principal travando o mapa, prioridade alta',
  projects: [{ name: 'VistaFor', aliases: ['PAX'], modules: ['Mapa'], tags: ['raster'] }],
  tasks: [{ title: 'Raster sobrepõe lotes', project: 'VistaFor' }],
}

function chatResponse(content: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }),
    text: async () => JSON.stringify(content),
  } as Response
}

const validSuggestion = {
  title: 'Corrigir carregamento da planta',
  summary: 'Planta trava o mapa ao carregar.',
  project: 'VistaFor',
  module: 'Mapa',
  kind: 'Bug',
  priority: 'P1',
  complexity: 'Alta',
  confidence: 92,
  evidence: ['Texto menciona planta e mapa.'],
  duplicates: ['Raster sobrepõe lotes'],
  action: 'Reproduzir e corrigir a causa raiz.',
}

describe('DeepSeekLlmProvider', () => {
  it('envia o texto e o contexto real, e devolve a proposta validada', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(chatResponse(validSuggestion))
    const provider = new DeepSeekLlmProvider({ apiKey: 'sk-teste', fetchImpl })

    const result = await provider.classify(input)

    expect(result).toMatchObject({ project: 'VistaFor', kind: 'Bug', priority: 'P1', confidence: 92 })
    expect(fetchImpl).toHaveBeenCalledWith('https://api.deepseek.com/chat/completions', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ authorization: 'Bearer sk-teste' }),
    }))
    const body = JSON.parse((fetchImpl.mock.calls[0]![1] as RequestInit).body as string)
    expect(body.model).toBe('deepseek-chat')
    expect(JSON.parse(body.messages[1].content)).toMatchObject({ text: input.text })
  })

  it('usa o modelo customizado quando informado', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(chatResponse(validSuggestion))
    const provider = new DeepSeekLlmProvider({ apiKey: 'sk-teste', model: 'deepseek-reasoner', fetchImpl })

    await provider.classify(input)

    const body = JSON.parse((fetchImpl.mock.calls[0]![1] as RequestInit).body as string)
    expect(body.model).toBe('deepseek-reasoner')
  })

  it('recusa projeto que não está na lista real — não confia cegamente no modelo', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(chatResponse({ ...validSuggestion, project: 'Projeto Inventado' }))
    const provider = new DeepSeekLlmProvider({ apiKey: 'sk-teste', fetchImpl })

    await expect(provider.classify(input)).rejects.toThrow('projeto inexistente')
  })

  it('filtra duplicidade que não existe na lista de tarefas reais', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(chatResponse({ ...validSuggestion, duplicates: ['Raster sobrepõe lotes', 'Tarefa inventada'] }))
    const provider = new DeepSeekLlmProvider({ apiKey: 'sk-teste', fetchImpl })

    const result = await provider.classify(input)

    expect(result.duplicates).toEqual(['Raster sobrepõe lotes'])
  })

  it('recusa resposta fora do schema (tipo/prioridade inválidos)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(chatResponse({ ...validSuggestion, kind: 'Não Existe' }))
    const provider = new DeepSeekLlmProvider({ apiKey: 'sk-teste', fetchImpl })

    await expect(provider.classify(input)).rejects.toThrow()
  })

  it('recusa JSON inválido no conteúdo', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'isso não é JSON' } }] }),
      text: async () => '',
    } as unknown as Response)
    const provider = new DeepSeekLlmProvider({ apiKey: 'sk-teste', fetchImpl })

    await expect(provider.classify(input)).rejects.toThrow('não devolveu um JSON válido')
  })

  it('propaga erro com o status quando a API responde com falha', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(chatResponse({ error: 'rate limited' }, 429))
    const provider = new DeepSeekLlmProvider({ apiKey: 'sk-teste', fetchImpl })

    await expect(provider.classify(input)).rejects.toThrow('429')
  })

  it('campo opcional vazio ("") não derruba a resposta — bug real visto em produção', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(chatResponse({ ...validSuggestion, due: '', forecast: '', responsible: '' }))
    const provider = new DeepSeekLlmProvider({ apiKey: 'sk-teste', fetchImpl })

    const result = await provider.classify(input)

    expect(result.due).toBeUndefined()
    expect(result.forecast).toBeUndefined()
    expect(result.responsible).toBeUndefined()
  })

  it('confiança fora de 0-100 é corrigida em vez de derrubar a resposta inteira', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(chatResponse({ ...validSuggestion, confidence: 150 }))
    const provider = new DeepSeekLlmProvider({ apiKey: 'sk-teste', fetchImpl })

    const result = await provider.classify(input)

    expect(result.confidence).toBe(100)
  })
})
