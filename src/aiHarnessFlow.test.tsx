import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HarnessReviewPanel, normalizeHarnessResponse, type HarnessClient, type HarnessView } from './aiHarnessFlow'
import type { InboxItem } from './domain'
import type { HarnessProposalV1 } from './server/ai/harness/contracts'

const inbox: InboxItem = {
  id: 'inbox-1',
  source: 'Áudio',
  status: 'Aguardando confirmação',
  date: 'agora',
  text: 'Transcrição original que deve permanecer separada.',
}

const markdownView: HarnessView = {
  run: { id: 'run-1', status: 'AWAITING_MARKDOWN_APPROVAL', version: 4, failedStep: null, errorCode: null, retryable: false },
  transcript: { id: 'transcript-1', version: 1, text: inbox.text, source: 'STT' },
  markdownRevision: { id: 'markdown-1', version: 1, content: '# Reunião\n\n- Decisão original', contentHash: 'hash-1', source: 'AI' },
  proposalRevision: null,
  selectedItemIds: [],
}

const userMarkdownView: HarnessView = {
  ...markdownView,
  markdownRevision: { ...markdownView.markdownRevision!, id: 'markdown-user-1', source: 'USER' },
}

const proposalView: HarnessView = {
  run: { id: 'run-1', status: 'AWAITING_ENTITY_APPROVAL', version: 8, failedStep: null, errorCode: null, retryable: false },
  transcript: markdownView.transcript,
  markdownRevision: { ...markdownView.markdownRevision!, id: 'markdown-approved', contentHash: 'approved-hash' },
  proposalRevision: {
    id: 'proposal-1',
    version: 1,
    contentHash: 'proposal-hash-1',
    proposal: {
      schemaVersion: 1,
      summary: 'Reunião com entrega dependente.',
      unresolved: [{ topicId: 'topic-3', reason: 'Projeto não identificado', evidence: [{ quote: 'Talvez exista outra frente.' }] }],
      items: [
        {
          id: 'task-base',
          topicIds: ['topic-1'],
          operation: 'CREATE',
          entity: 'TASK',
          dependsOn: [],
          evidence: [{ topicId: 'topic-1', quote: 'Preparar relatório.' }],
          confidence: { type: 95, project: 80 },
          duplicateCandidates: [],
          data: { project: { existingId: 'project-1' }, title: 'Preparar relatório', status: 'BACKLOG', priority: 'P1' },
        },
        {
          id: 'task-dependent',
          topicIds: ['topic-2'],
          operation: 'CREATE',
          entity: 'TASK',
          dependsOn: ['task-base'],
          evidence: [{ topicId: 'topic-2', quote: 'Depois, enviar relatório.' }],
          confidence: { type: 90, project: 80 },
          duplicateCandidates: ['Relatório mensal'],
          data: { project: { existingId: 'project-1' }, title: 'Enviar relatório', status: 'BACKLOG', priority: 'P2' },
        },
      ],
    },
  },
  selectedItemIds: ['task-base', 'task-dependent'],
}

function client(view: HarnessView): HarnessClient {
  return {
    load: vi.fn().mockResolvedValue(view),
    saveMarkdown: vi.fn().mockImplementation(async (_id, input) => ({
      ...view,
      run: { ...view.run, version: view.run.version + 1 },
      markdownRevision: { id: 'markdown-user-2', version: 2, content: input.content, contentHash: 'hash-user-2', source: 'USER' },
    })),
    approveMarkdown: vi.fn().mockResolvedValue({ ...view, run: { ...view.run, status: 'RETRIEVING_REFERENCES', version: view.run.version + 1 } }),
    saveProposal: vi.fn().mockImplementation(async (_id, input) => ({
      ...view,
      run: { ...view.run, version: view.run.version + 1 },
      proposalRevision: { id: 'proposal-user-2', version: 2, contentHash: 'proposal-user-hash', proposal: input.proposal },
      selectedItemIds: input.selectedItemIds,
    })),
    execute: vi.fn().mockResolvedValue({ ...view, run: { ...view.run, status: 'PROCESSED', version: view.run.version + 1 } }),
    retry: vi.fn().mockResolvedValue(view),
    discard: vi.fn().mockResolvedValue({ ...view, run: { ...view.run, status: 'DISCARDED' } }),
  }
}

describe('front do harness supervisionado', () => {
  /**
   * Protege: reload reconstrói editor e preview a partir do read model persistido.
   * Regressão real: UI espera nomes internos e perde revisão ativa após F5.
   * Impacto: usuário vê tela vazia e pode repetir captura ou aprovação.
   */
  it('normaliza o read model persistido sem descartar proposta ou seleção', () => {
    expect(normalizeHarnessResponse({ harness: {
      id: 'run-1', status: 'AWAITING_ENTITY_APPROVAL', version: 8, failedStep: null, errorCode: null, retryable: false,
      transcript: { id: 'transcript-1', version: 1, text: 'Original', source: 'TEXT' },
      markdown: { id: 'markdown-2', version: 2, content: '# Aprovado', contentHash: 'm-hash' },
      proposal: { id: 'proposal-1', version: 1, contentHash: 'p-hash', validatedPlan: proposalView.proposalRevision!.proposal, selectedItemIds: ['task-base'] },
    } })).toMatchObject({
      run: { id: 'run-1', status: 'AWAITING_ENTITY_APPROVAL', version: 8 },
      markdownRevision: { id: 'markdown-2', content: '# Aprovado' },
      proposalRevision: { id: 'proposal-1', proposal: proposalView.proposalRevision!.proposal },
      selectedItemIds: ['task-base'],
    })
  })

  /**
   * Protege: edição canônica precisa virar revisão salva antes da aprovação 1.
   * Regressão real: botão aprova hash antigo enquanto autosave ainda está pendente.
   * Impacto: conteúdo removido volta ou acréscimo humano não chega à proposta final.
   */
  it('salva Markdown editado e aprova exatamente a revisão retornada pelo servidor', async () => {
    const api = client(userMarkdownView)
    render(<HarnessReviewPanel inboxItem={inbox} client={api} notify={vi.fn()} onBack={vi.fn()} autosaveDelayMs={25} />)

    const editor = await screen.findByRole('textbox', { name: 'Conteúdo interpretado' })
    expect(screen.getByText(inbox.text)).toBeInTheDocument()
    await userEvent.type(editor, '\n- Acréscimo humano')

    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
    await waitFor(() => expect(api.saveMarkdown).toHaveBeenCalledWith('inbox-1', expect.objectContaining({
      expectedVersion: 4,
      content: expect.stringContaining('Acréscimo humano'),
    })))
    await waitFor(() => expect(screen.getByText('Salvo')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(api.approveMarkdown).toHaveBeenCalledWith('inbox-1', {
      expectedVersion: 5,
      markdownRevisionId: 'markdown-user-2',
      targetHash: 'hash-user-2',
    })
  })

  /**
   * Protege: autosaves são serializados e a edição mais recente sobrevive à resposta anterior.
   * Regressão real: duas requisições usam mesma `expectedVersion` ou remount apaga texto ainda local.
   * Impacto: conflito falso e perda silenciosa de correção humana antes da aprovação 1.
   */
  it('espera autosave em curso antes de salvar edição mais nova', async () => {
    let resolveFirst!: (view: HarnessView) => void
    const firstSave = new Promise<HarnessView>((resolve) => { resolveFirst = resolve })
    const afterFirst: HarnessView = {
      ...userMarkdownView,
      run: { ...userMarkdownView.run, version: 5 },
      markdownRevision: { id: 'markdown-user-2', version: 2, content: '# Primeira edição', contentHash: 'hash-user-2', source: 'USER' },
    }
    const afterSecond: HarnessView = {
      ...afterFirst,
      run: { ...afterFirst.run, version: 6 },
      markdownRevision: { id: 'markdown-user-3', version: 3, content: '# Segunda edição', contentHash: 'hash-user-3', source: 'USER' },
    }
    const api = client(userMarkdownView)
    vi.mocked(api.saveMarkdown)
      .mockImplementationOnce(() => firstSave)
      .mockResolvedValueOnce(afterSecond)

    render(<HarnessReviewPanel inboxItem={inbox} client={api} notify={vi.fn()} onBack={vi.fn()} autosaveDelayMs={0} />)
    const editor = await screen.findByRole('textbox', { name: 'Conteúdo interpretado' })
    fireEvent.change(editor, { target: { value: '# Primeira edição' } })
    await waitFor(() => expect(api.saveMarkdown).toHaveBeenCalledTimes(1))

    fireEvent.change(editor, { target: { value: '# Segunda edição' } })
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(api.saveMarkdown).toHaveBeenCalledTimes(1)

    await act(async () => { resolveFirst(afterFirst); await firstSave })
    await waitFor(() => expect(api.saveMarkdown).toHaveBeenNthCalledWith(2, 'inbox-1', expect.objectContaining({
      expectedVersion: 5,
      content: '# Segunda edição',
    })))
    expect(editor).toHaveValue('# Segunda edição')
  })

  /**
   * Protege: item usado por outro item selecionado permanece selecionado.
   * Regressão real: remoção deixa `dependsOn` apontando para item ausente.
   * Impacto: aprovação 2 falha ou plano executa com ordem/relação inconsistente.
   */
  it('impede remover dependência ainda usada e mostra unresolved sem inventar entidade', async () => {
    const api = client(proposalView)
    render(<HarnessReviewPanel inboxItem={inbox} client={api} notify={vi.fn()} onBack={vi.fn()} autosaveDelayMs={25} />)

    const dependency = await screen.findByRole('checkbox', { name: 'Incluir Preparar relatório' })
    expect(dependency).toBeDisabled()
    expect(screen.getByText('Projeto não identificado')).toBeInTheDocument()
    expect(screen.getByText('Relatório mensal')).toBeInTheDocument()
  })

  /**
   * Protege: correção no preview cria revisão de usuário antes da aprovação 2.
   * Regressão real: execução usa proposta original mesmo após usuário editar título.
   * Impacto: entidade nasce com dado incorreto e perde confiança/rastreabilidade.
   */
  it('salva preview consolidado editado e executa somente revisão e seleção atuais', async () => {
    const api = client(proposalView)
    render(<HarnessReviewPanel inboxItem={inbox} client={api} notify={vi.fn()} onBack={vi.fn()} autosaveDelayMs={25} />)

    const title = await screen.findByLabelText('Título de Preparar relatório')
    fireEvent.change(title, { target: { value: 'Preparar relatório final' } })
    expect(screen.getByRole('button', { name: 'Criar 2 itens' })).toBeDisabled()

    await waitFor(() => expect(api.saveProposal).toHaveBeenCalledWith('inbox-1', expect.objectContaining({
      expectedVersion: 8,
      selectedItemIds: ['task-base', 'task-dependent'],
      proposal: expect.objectContaining({ items: expect.arrayContaining([
        expect.objectContaining({ id: 'task-base', data: expect.objectContaining({ title: 'Preparar relatório final' }) }),
      ]) }),
    })))
    await waitFor(() => expect(screen.getByText('Salvo')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Criar 2 itens' }))

    expect(api.execute).toHaveBeenCalledWith('inbox-1', {
      expectedVersion: 9,
      proposalRevisionId: 'proposal-user-2',
      targetHash: 'proposal-user-hash',
      selectedItemIds: ['task-base', 'task-dependent'],
    })
  })

  /**
   * Protege: falha global da materialização aparece como uma pendência consolidada.
   * Regressão real: o fallback cria um UNRESOLVED por tópico com mesmo motivo/evidência.
   * Impacto: usuário interpreta a mesma falha como várias solicitações repetidas.
   */
  it('consolida unresolved repetidos no preview da proposta', async () => {
    const repeated = Array.from({ length: 5 }, (_, index) => ({
      topicId: `topic-${index + 1}`,
      reason: 'Campos obrigatórios ausentes na resposta da IA.',
      evidence: [{ quote: 'Markdown aprovado completo.' }],
    }))
    const repeatedView: HarnessView = {
      ...proposalView,
      selectedItemIds: [],
      proposalRevision: {
        ...proposalView.proposalRevision!,
        proposal: { ...proposalView.proposalRevision!.proposal, items: [], unresolved: repeated },
      },
    }
    const api = client(repeatedView)

    render(<HarnessReviewPanel inboxItem={inbox} client={api} notify={vi.fn()} onBack={vi.fn()} autosaveDelayMs={25} />)

    expect(await screen.findAllByText('Campos obrigatórios ausentes na resposta da IA.')).toHaveLength(1)
    expect(screen.getAllByText('Markdown aprovado completo.')).toHaveLength(1)
    expect(screen.getByText('5 tópicos agrupados')).toBeInTheDocument()
  })

  /**
   * Protege: proposta sem entidades continua aprovável e preserva conteúdo como UNRESOLVED.
   * Detecta: UI restaura seleção vazia como "todos" ou desabilita a aprovação final.
   * Impacto: usuário é forçado a criar entidade inventada ou deixa a captura presa para sempre.
   */
  it('aprova proposta unresolved sem criar entidades e preserva seleção vazia', async () => {
    const unresolvedOnly: HarnessView = {
      ...proposalView,
      selectedItemIds: [],
      proposalRevision: {
        ...proposalView.proposalRevision!,
        proposal: {
          ...proposalView.proposalRevision!.proposal,
          unresolved: [{ topicId: 'topic-only', reason: 'Projeto não identificado', evidence: [{ quote: 'Relatório mensal' }] }],
        },
      },
    }
    const api = client(unresolvedOnly)
    vi.mocked(api.execute).mockResolvedValueOnce({
      ...unresolvedOnly,
      run: { ...unresolvedOnly.run, status: 'PROCESSED', version: unresolvedOnly.run.version + 1 },
    })
    render(<HarnessReviewPanel inboxItem={inbox} client={api} notify={vi.fn()} onBack={vi.fn()} autosaveDelayMs={25} />)

    const approve = await screen.findByRole('button', { name: 'Concluir sem criar itens' })
    expect(approve).toBeEnabled()
    expect(screen.getByRole('checkbox', { name: 'Incluir Preparar relatório' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Incluir Enviar relatório' })).not.toBeChecked()
    expect(screen.getByText('Nenhuma entidade será criada; o conteúdo permanece não resolvido.')).toBeInTheDocument()
    await userEvent.click(approve)

    expect(api.execute).toHaveBeenCalledWith('inbox-1', {
      expectedVersion: unresolvedOnly.run.version,
      proposalRevisionId: unresolvedOnly.proposalRevision!.id,
      targetHash: unresolvedOnly.proposalRevision!.contentHash,
      selectedItemIds: [],
    })
  })

  /**
   * Protege: campos operacionais permitidos da tarefa podem ser corrigidos no preview.
   * Regressão real: preview mostra só título/prioridade e persiste status, módulo, previsão e tags antigos.
   * Impacto: card aprovado nasce incompleto e exige retrabalho manual depois da execução atômica.
   */
  it('edita campos operacionais completos da tarefa antes da aprovação 2', async () => {
    const api = client(proposalView)
    render(<HarnessReviewPanel inboxItem={inbox} client={api} notify={vi.fn()} onBack={vi.fn()} autosaveDelayMs={25} />)
    await screen.findByLabelText('Título de Preparar relatório')

    fireEvent.change(screen.getByLabelText('Módulo de Preparar relatório'), { target: { value: 'Relatórios' } })
    await userEvent.selectOptions(screen.getByLabelText('Status de Preparar relatório'), 'IN_PROGRESS')
    fireEvent.change(screen.getByLabelText('Previsão de Preparar relatório'), { target: { value: '2026-08-07T09:30' } })
    fireEvent.change(screen.getByLabelText('Tags de Preparar relatório'), { target: { value: 'mensal, diretoria' } })

    await waitFor(() => expect(api.saveProposal).toHaveBeenLastCalledWith('inbox-1', expect.objectContaining({
      proposal: expect.objectContaining({ items: expect.arrayContaining([
        expect.objectContaining({ id: 'task-base', data: expect.objectContaining({
          moduleName: 'Relatórios',
          status: 'IN_PROGRESS',
          forecastAt: '2026-08-07T09:30:00-03:00',
          tags: ['mensal', 'diretoria'],
        }) }),
      ]) }),
    })))
  })

  /**
   * Protege: usuário pode corrigir tipo sem perder evidência, projeto ou relações locais.
   * Regressão real: troca apenas rótulo visual e envia payload antigo de tarefa.
   * Impacto: dado nasce na entidade errada ou nota perde privacidade obrigatória.
   */
  it('troca tarefa por nota privada e persiste payload compatível', async () => {
    const api = client(proposalView)
    render(<HarnessReviewPanel inboxItem={inbox} client={api} notify={vi.fn()} onBack={vi.fn()} autosaveDelayMs={25} />)

    const type = await screen.findByLabelText('Tipo de Preparar relatório')
    await userEvent.selectOptions(type, 'NOTE')

    expect(screen.getByLabelText('Privacidade')).toHaveValue('Privada')
    await waitFor(() => expect(api.saveProposal).toHaveBeenCalledWith('inbox-1', expect.objectContaining({
      proposal: expect.objectContaining({ items: expect.arrayContaining([
        expect.objectContaining({
          id: 'task-base', entity: 'NOTE',
          evidence: proposalView.proposalRevision!.proposal.items[0].evidence,
          data: expect.objectContaining({ title: 'Preparar relatório', private: true, project: { existingId: 'project-1' } }),
        }),
      ]) }),
    })))
  })

  /**
   * Protege: após aprovação 1, usuário pode reabrir Markdown preservado e refazer derivados.
   * Regressão real: preview vira caminho sem volta ou front edita proposta sem invalidar snapshot antigo.
   * Impacto: conteúdo rejeitado pode ser executado porque usuário não consegue corrigir fonte autoritativa.
  it('volta do preview para nova revisão Markdown e descarta proposta ativa', async () => {
    const reopened: HarnessView = {
      ...proposalView,
      run: { ...proposalView.run, status: 'AWAITING_MARKDOWN_APPROVAL', version: 9 },
      markdownRevision: { ...proposalView.markdownRevision!, id: 'markdown-user-3', version: 3, contentHash: 'markdown-user-3-hash', source: 'USER' },
      proposalRevision: null,
      selectedItemIds: [],
    }
    const api = client(proposalView)
    vi.mocked(api.saveMarkdown).mockResolvedValueOnce(reopened)
    render(<HarnessReviewPanel inboxItem={inbox} client={api} notify={vi.fn()} onBack={vi.fn()} autosaveDelayMs={25} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Editar conteúdo' }))

    expect(api.saveMarkdown).toHaveBeenCalledWith('inbox-1', {
      expectedVersion: 8,
      parentRevisionId: 'markdown-approved',
      content: proposalView.markdownRevision!.content,
    })
    expect(await screen.findByRole('heading', { name: 'Conteúdo interpretado' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Conteúdo interpretado' })).toHaveValue(proposalView.markdownRevision!.content)
    expect(screen.queryByRole('button', { name: 'Criar 2 itens' })).not.toBeInTheDocument()
    expect(api.execute).not.toHaveBeenCalled()
  })

  /**
   * Protege: falha final preserva run e oferece retry apenas quando autorizado.
   * Regressão real: UI trata `FAILED` como vazio ou cria nova captura para tentar de novo.
   * Impacto: usuário perde rastreabilidade e pode duplicar entrada/cobrança.
   */
  it('mostra erro acionável e repete a etapa falha no mesmo run', async () => {
    const failed: HarnessView = {
      ...markdownView,
      run: { id: 'run-1', status: 'FAILED', version: 6, failedStep: 'ORGANIZING', errorCode: 'PROVIDER_RATE_LIMITED', retryable: true },
    }
    const api = client(failed)
    render(<HarnessReviewPanel inboxItem={inbox} client={api} notify={vi.fn()} onBack={vi.fn()} />)

    expect(await screen.findByText('Não foi possível organizar o conteúdo agora.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(api.retry).toHaveBeenCalledWith('inbox-1')
  })

  /**
   * Protege: card criado junto com projeto novo mantém referência local ao projeto proposto.
   * Regressão real: o select só recebe projetos persistidos e exibe o primeiro projeto antigo,
   * fazendo preview/edição perder o vínculo com o projeto que será criado.
   * Impacto: aprovação pode enviar card para projeto errado ou induzir correção manual incorreta.
   */
  it('mantém card vinculado ao projeto novo no preview', async () => {
    const proposal: HarnessProposalV1 = {
      schemaVersion: 1,
      summary: 'Projeto novo com card.',
      unresolved: [],
      items: [
        {
          id: 'project-new', topicIds: ['topic-project'], operation: 'CREATE', entity: 'PROJECT', dependsOn: [],
          evidence: [{ topicId: 'topic-project', quote: 'Criar Portal novo' }], confidence: { type: 95 }, duplicateCandidates: [],
          data: { name: 'Portal novo' },
        },
        {
          id: 'task-new', topicIds: ['topic-task'], operation: 'CREATE', entity: 'TASK', dependsOn: ['project-new'],
          evidence: [{ topicId: 'topic-task', quote: 'Criar tela inicial' }], confidence: { type: 95, project: 95 }, duplicateCandidates: [],
          data: { project: { localId: 'project-new' }, title: 'Criar tela inicial', status: 'BACKLOG', priority: 'P2' },
        },
      ],
    }
    const view: HarnessView = {
      ...proposalView,
      proposalRevision: { ...proposalView.proposalRevision!, proposal, contentHash: 'new-project-proposal' },
      selectedItemIds: ['project-new', 'task-new'],
    }
    const api = client(view)
    render(<HarnessReviewPanel
      inboxItem={inbox}
      client={api}
      notify={vi.fn()}
      onBack={vi.fn()}
      projects={[{ id: 'project-old', name: 'Projeto antigo', description: '', color: '#000000', progress: 0, priority: 'P2', aliases: [], modules: [], tags: [], archived: false }]}
      autosaveDelayMs={25}
    />)

    await screen.findByRole('option', { name: 'Portal novo' })
    const projectField = screen.getAllByLabelText('Projeto').find((element) => element instanceof HTMLSelectElement)
    expect(projectField).toBeDefined()
    expect(projectField).toHaveValue('project-new')
    expect(screen.getByRole('option', { name: 'Portal novo' })).toBeInTheDocument()
  })

  /**
   * Protege: conteúdo e proposta aparecem na mesma superfície, sem telas intermediárias.
   * Regressão real: fluxo volta a separar editor Markdown e preview da proposta em rotas/abas distintas.
   * Impacto: usuário navega entre telas e perde a visão consolidada do resultado.
   */
  it('consolida resumo, conteúdo expansível, itens editáveis e pendências numa revisão única', async () => {
    const api = client(proposalView)
    render(<HarnessReviewPanel inboxItem={inbox} client={api} notify={vi.fn()} onBack={vi.fn()} autosaveDelayMs={25} />)

    // Jargão interno de aprovação some da UI.
    expect(await screen.findByText('Reunião com entrega dependente.')).toBeInTheDocument()
    expect(screen.queryByText(/APROVAÇÃO 1 DE 2|APROVAÇÃO 2 DE 2/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Markdown', { exact: false })).not.toBeInTheDocument()
    expect(screen.queryByText('Materializando', { exact: false })).not.toBeInTheDocument()

    // Conteúdo interpretado fica em seção expansível dentro da mesma tela.
    const contentToggle = screen.getByRole('button', { name: /Conteúdo interpretado/ })
    expect(contentToggle).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(contentToggle)
    expect(screen.getByText(/Decisão original/)).toBeInTheDocument()

    // Itens propostos continuam editáveis na mesma tela.
    const title = screen.getByLabelText('Título de Preparar relatório')
    fireEvent.change(title, { target: { value: 'Preparar relatório final' } })
    expect(screen.getByText('Projeto não identificado')).toBeInTheDocument()

    // CTA final único, com contagem.
    expect(screen.getByRole('button', { name: 'Criar 2 itens' })).toBeInTheDocument()
  })

  /**
   * Protege: nada é criado antes do clique no CTA final; o CTA usa a revisão salva e a seleção atual.
   * Regressão real: execução dispara no autosave, no load ou com revisão/hash antigos.
   * Impacto: entidade nasce sem confirmação ou com conteúdo já corrigido pelo usuário.
   */
  it('não cria nada antes do CTA final com contagem e executa somente revisão salva', async () => {
    const api = client(proposalView)
    render(<HarnessReviewPanel inboxItem={inbox} client={api} notify={vi.fn()} onBack={vi.fn()} autosaveDelayMs={25} />)

    const title = await screen.findByLabelText('Título de Preparar relatório')
    expect(api.execute).not.toHaveBeenCalled()

    fireEvent.change(title, { target: { value: 'Preparar relatório final' } })
    expect(screen.getByRole('button', { name: 'Criar 2 itens' })).toBeDisabled()
    await waitFor(() => expect(screen.getByText('Salvo')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'Criar 2 itens' }))
    expect(api.execute).toHaveBeenCalledTimes(1)
    expect(api.execute).toHaveBeenCalledWith('inbox-1', {
      expectedVersion: 9,
      proposalRevisionId: 'proposal-user-2',
      targetHash: 'proposal-user-hash',
      selectedItemIds: ['task-base', 'task-dependent'],
    })
  })

  /**
   * Protege: conteúdo gerado segue automaticamente para contextualização, sem criar entidade antes do CTA final.
   * Regressão real: usuário fica preso em uma aprovação técnica intermediária ou execução dispara durante o processamento.
   * Impacto: gravação exige decisão que usuário não entende e pode criar dados antes da revisão final.
   */
  it('prepara resultado final automaticamente e não cria na etapa intermediária', async () => {
    const api = client(markdownView)
    render(<HarnessReviewPanel inboxItem={inbox} client={api} notify={vi.fn()} onBack={vi.fn()} autosaveDelayMs={25} />)

    await waitFor(() => expect(api.approveMarkdown).toHaveBeenCalledWith('inbox-1', {
      expectedVersion: 4,
      markdownRevisionId: 'markdown-1',
      targetHash: 'hash-1',
    }))
    expect(screen.queryByRole('button', { name: 'Continuar' })).not.toBeInTheDocument()
    expect(api.execute).not.toHaveBeenCalled()
  })


  /**
   * Protege: usuário pode adicionar e remover itens na revisão consolidada; autosave preserva.
   * Regressão real: adição é só visual ou não passa pela validação do servidor (tópico/evidência).
   * Impacto: item novo some no reload ou a proposta é rejeitada no fim do fluxo.
   */
  it('adiciona e remove itens na revisão única preservando a seleção', async () => {
    const api = client(proposalView)
    render(<HarnessReviewPanel inboxItem={inbox} client={api} notify={vi.fn()} onBack={vi.fn()} autosaveDelayMs={25} />)

    await screen.findByLabelText('Título de Preparar relatório')
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar item' }))

    expect(await screen.findByLabelText('Título de Nova tarefa')).toBeInTheDocument()
    await waitFor(() => expect(api.saveProposal).toHaveBeenLastCalledWith('inbox-1', expect.objectContaining({
      proposal: expect.objectContaining({ items: expect.arrayContaining([
        expect.objectContaining({ id: 'user-item-1', entity: 'TASK', topicIds: ['user-added'] }),
      ]) }),
    })))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Criar 3 itens' })).toBeEnabled())

    await userEvent.click(screen.getByRole('checkbox', { name: 'Incluir Nova tarefa' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Criar 2 itens' })).toBeEnabled())
  })
})
