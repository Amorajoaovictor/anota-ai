import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ContextReviewQueue, SmartInboxView } from './contextFlow'
import type { AppState } from './domain'
import type { ProjectActions } from './lib/store'
import type { AiPlan } from './server/ai/plan'

const plan: AiPlan = {
  summary: 'Uma tarefa com prazo e um fato importante sobre sua complexidade.',
  confidence: 91,
  evidence: ['O áudio cita prazo e dificuldade percebida.'],
  actions: [
    {
      id: 'task-1',
      operation: 'create',
      entity: 'task',
      dependsOn: [],
      confidence: 94,
      evidence: ['Trecho descreve uma entrega concreta.'],
      data: {
        project: { existingId: 'project-1' },
        title: 'Preparar relatório',
        description: 'Relatório parece mais complexo que o previsto.',
        complexity: 3,
        dueAt: '2026-08-05T00:00:00.000Z',
      },
    },
    {
      id: 'context-1',
      operation: 'create',
      entity: 'context',
      dependsOn: ['task-1'],
      confidence: 89,
      evidence: ['A percepção de complexidade deve acompanhar a tarefa.'],
      data: {
        project: { existingId: 'project-1' },
        task: { actionId: 'task-1' },
        category: 'FACT',
        title: 'Complexidade percebida',
        content: 'O relatório parece mais complexo que o previsto.',
      },
    },
  ],
}

const state: AppState = {
  projects: [{ id: 'project-1', name: 'Observa', description: '', color: '#64a3ff', progress: 0, priority: 'P1', aliases: [], modules: [], tags: [], archived: false }],
  tasks: [],
  actionPlan: [],
  milestones: [],
  notes: [],
  contexts: [],
  activity: [],
  inbox: [{
    id: 'inbox-1',
    source: 'Áudio',
    status: 'Aguardando confirmação',
    date: 'agora',
    text: 'Preciso preparar o relatório até dia cinco. Parece mais complexo que o previsto.',
    suggestion: plan,
  }],
}

describe('fluxo intermediário das informações extraídas', () => {
  /**
   * Protege: entrada legada com plano abre direto a revisão única final editável.
   * Regressão real: volta a etapa de extração com AiFlowSteps e botão "Transformar em proposta".
   * Impacto: usuário navega entre telas e perde a visão consolidada do resultado.
   */
  it('abre revisão única legada editável e preserva correções na aprovação', async () => {
    const confirmInbox = vi.fn()
    const actions = {
      refreshInbox: vi.fn(),
      confirmInbox,
      discardInbox: vi.fn(),
    } as unknown as ProjectActions

    render(<ContextReviewQueue state={state} setState={vi.fn()} actions={actions} notify={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /Revisar proposta/i }))

    // Uma única revisão final: sem etapa de extração nem stepper intermediário.
    expect(screen.getByRole('heading', { name: 'Revise o plano completo' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Informações extraídas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Transformar em proposta' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Etapas do processamento')).not.toBeInTheDocument()

    expect(screen.getByLabelText('Prazo citado')).toHaveValue('2026-08-05')
    expect(screen.getByLabelText('Complexidade percebida')).toHaveValue('3')

    const title = screen.getByLabelText('Título da tarefa')
    await userEvent.clear(title)
    await userEvent.type(title, 'Preparar relatório final')
    await userEvent.click(screen.getByRole('button', { name: 'Aprovar plano' }))
    expect(confirmInbox).toHaveBeenCalledWith('inbox-1', expect.objectContaining({
      actions: expect.arrayContaining([expect.objectContaining({
        id: 'task-1',
        data: expect.objectContaining({ title: 'Preparar relatório final' }),
      })]),
    }))
  })

  /**
   * Protege: seleção e cascata de dependências continuam funcionando na revisão única.
   * Regressão real: unificar telas perde o `toggle` com dependências ou envia ações desmarcadas.
   * Impacto: execução cria contexto órfão ou ignora a escolha do usuário.
   */
  it('mantém seleção e dependências na revisão única legada', async () => {
    const confirmInbox = vi.fn()
    const actions = {
      refreshInbox: vi.fn(),
      confirmInbox,
      discardInbox: vi.fn(),
    } as unknown as ProjectActions

    render(<ContextReviewQueue state={state} setState={vi.fn()} actions={actions} notify={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /Revisar proposta/i }))

    const task = screen.getByRole('checkbox', { name: /Tarefa · confiança 94%/ })
    const context = screen.getByRole('checkbox', { name: /Contexto · confiança 89%/ })
    expect(task).toBeChecked()
    expect(context).toBeChecked()

    // Desmarcar a tarefa-base derruba o contexto que depende dela; re-selecionar não o ressuscita.
    await userEvent.click(task)
    expect(task).not.toBeChecked()
    expect(context).not.toBeChecked()
    await userEvent.click(task)
    expect(context).not.toBeChecked()

    await userEvent.click(screen.getByRole('button', { name: 'Aprovar plano' }))
    expect(confirmInbox).toHaveBeenCalledWith('inbox-1', expect.objectContaining({
      actions: [expect.objectContaining({ id: 'task-1' })],
    }))
  })
})

describe('entrada do harness v2', () => {
  /**
   * Protege: captura v2 sem `suggestion` continua alcançável pela fila e recarrega run persistido.
   * Regressão real: botão fica desabilitado porque fluxo antigo só abria itens com classificação pronta.
   * Impacto: usuário não vê processamento, erro nem editor Markdown e repete a entrada.
   */
  it('abre andamento persistido mesmo sem sugestão legada', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ harness: {
      id: 'run-1', status: 'ORGANIZING', version: 2, failedStep: null, errorCode: null, retryable: false,
      transcript: { id: 'transcript-1', version: 1, text: 'Entrada v2', source: 'TEXT' },
      markdown: null, proposal: null, jobs: [],
    } }), { status: 200, headers: { 'content-type': 'application/json' } })))
    const v2State: AppState = {
      ...state,
      inbox: [{ id: 'inbox-v2', source: 'Texto', status: 'Recebida', date: 'agora', text: 'Entrada v2', harness: true }],
    }
    const actions = { refreshInbox: vi.fn() } as unknown as ProjectActions

    render(<SmartInboxView state={v2State} setState={vi.fn()} actions={actions} notify={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ver andamento' }))

    expect(await screen.findByRole('heading', { name: 'Organizando conteúdo' })).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/inbox/inbox-v2/harness', expect.objectContaining({ credentials: 'same-origin' }))
    vi.unstubAllGlobals()
  })

  /**
   * Protege: entrada legada sem classificação não tenta carregar um AiRun inexistente.
   * Detecta: condição baseada somente em `suggestion`, que chama `/harness` durante ai.classify.
   * Impacto: usuário vê erro falso, perde acompanhamento do processamento e pode repetir a captura.
   */
  it('mantém entrada legada pendente fora da revisão v2', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const legacyState: AppState = {
      ...state,
      inbox: [{ id: 'inbox-legacy', source: 'Texto', status: 'Analisando contexto', date: 'agora', text: 'Entrada legada' }],
    }
    const actions = { refreshInbox: vi.fn() } as unknown as ProjectActions

    render(<SmartInboxView state={legacyState} setState={vi.fn()} actions={actions} notify={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ver andamento' }))

    expect(screen.getByRole('heading', { name: 'Processando entrada' })).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})

function harnessViewResponse() {
  return new Response(JSON.stringify({ harness: {
    id: 'run-1', status: 'ORGANIZING', version: 2, failedStep: null, errorCode: null, retryable: false,
    transcript: { id: 'transcript-1', version: 1, text: 'Entrada v2', source: 'TEXT' },
    markdown: null, proposal: null, jobs: [],
  } }), { status: 200, headers: { 'content-type': 'application/json' } })
}

describe('captura abre automaticamente a revisão do item criado', () => {
  /**
   * Protege: após capturar texto, a revisão do item criado abre sem passar pela fila.
   * Regressão real: captura só limpa o campo e exige clicar no card para revisar.
   * Impacto: usuário perde o contexto do processamento e pode repetir a entrada.
   */
  it('abre automaticamente a revisão do item recém-capturado em texto', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(harnessViewResponse()))
    const captureInbox = vi.fn().mockResolvedValue('inbox-novo')
    const actions = { refreshInbox: vi.fn(), captureInbox } as unknown as ProjectActions
    const autoOpenState: AppState = {
      ...state,
      inbox: [{ id: 'inbox-novo', source: 'Texto', status: 'Recebida', date: 'agora', text: 'Nova entrada de teste', harness: true }],
    }

    render(<SmartInboxView state={autoOpenState} setState={vi.fn()} actions={actions} notify={vi.fn()} />)
    await userEvent.type(screen.getByPlaceholderText(/Ex\.:/), 'Nova entrada de teste')
    await userEvent.click(screen.getByRole('button', { name: 'Organizar com IA' }))

    expect(captureInbox).toHaveBeenCalledWith('Nova entrada de teste')
    expect(await screen.findByRole('heading', { name: 'Organizando conteúdo' })).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  /**
   * Protege: ao parar a gravação, a revisão do item criado abre automaticamente.
   * Regressão real: áudio vira apenas um card na lista e o usuário precisa caçá-lo.
   * Impacto: usuário não acompanha transcrição/processamento e reenvia a gravação.
   */
  it('abre automaticamente a revisão do item criado ao parar a gravação', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(harnessViewResponse()))
    class FakeMediaRecorder {
      static mimeType = 'audio/webm'
      mimeType = 'audio/webm'
      ondataavailable: ((event: { data: Blob }) => void) | null = null
      onstop: (() => void) | null = null
      start() {}
      stop() { this.onstop?.() }
    }
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
    })
    const captureInboxAudio = vi.fn().mockResolvedValue('inbox-audio')
    const actions = { refreshInbox: vi.fn(), captureInbox: vi.fn(), captureInboxAudio } as unknown as ProjectActions
    const audioState: AppState = {
      ...state,
      inbox: [{ id: 'inbox-audio', source: 'Áudio', status: 'Recebida', date: 'agora', text: '', harness: true }],
    }

    render(<SmartInboxView state={audioState} setState={vi.fn()} actions={actions} notify={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Gravar áudio' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Parar gravação' }))

    await waitFor(() => expect(captureInboxAudio).toHaveBeenCalledWith(expect.any(Blob)))
    expect(await screen.findByRole('heading', { name: 'Organizando conteúdo' })).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  /**
   * Protege: upload de arquivo de áudio abre a mesma revisão consolidada.
   * Regressão real: upload só aparece na lista e o fluxo de texto/áudio diverge.
   * Impacto: usuário não acompanha o processamento de arquivos enviados.
   */
  it('abre automaticamente a revisão do item criado ao enviar arquivo de áudio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(harnessViewResponse()))
    const captureInboxAudio = vi.fn().mockResolvedValue('inbox-arquivo')
    const actions = { refreshInbox: vi.fn(), captureInbox: vi.fn(), captureInboxAudio } as unknown as ProjectActions
    const fileState: AppState = {
      ...state,
      inbox: [{ id: 'inbox-arquivo', source: 'Áudio', status: 'Recebida', date: 'agora', text: '', harness: true }],
    }

    const { container } = render(<SmartInboxView state={fileState} setState={vi.fn()} actions={actions} notify={vi.fn()} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['audio'], 'gravacao.webm', { type: 'audio/webm' })
    await userEvent.upload(fileInput, file)

    await waitFor(() => expect(captureInboxAudio).toHaveBeenCalledWith(file))
    expect(await screen.findByRole('heading', { name: 'Organizando conteúdo' })).toBeInTheDocument()
    vi.unstubAllGlobals()
  })
})
