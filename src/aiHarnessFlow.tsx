'use client'

import {
  Archive,
  ArrowLeft,
  CalendarBlank,
  CaretDown,
  Check,
  CheckCircle,
  FileAudio,
  FileText,
  Flag,
  FloppyDisk,
  Link as LinkIcon,
  ListBullets,
  MagicWand,
  NotePencil,
  Plus,
  SpinnerGap,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { InboxItem, Project } from './domain'
import { ApiError, getJson, postJson, putJson } from './lib/api'
import type { HarnessProposalV1 } from './server/ai/harness/contracts'
import type { HarnessRunStatus } from './server/ai/harness/state-machine'
import { Button, PageHeading, type Notify } from './ui'

export type HarnessView = {
  run: {
    id: string
    status: HarnessRunStatus
    version: number
    failedStep: HarnessRunStatus | null
    errorCode: string | null
    retryable: boolean
    attempt?: number | null
    nextRetryAt?: string | null
  }
  transcript: { id: string; version: number; text: string; source: 'TEXT' | 'STT' } | null
  markdownRevision: { id: string; version: number; content: string; contentHash: string; source?: 'AI' | 'USER' } | null
  proposalRevision: { id: string; version: number; contentHash: string; proposal: HarnessProposalV1 } | null
  selectedItemIds: string[]
  permissions?: { editMarkdown: boolean; approveMarkdown: boolean; editProposal: boolean; execute: boolean; retry: boolean; discard: boolean }
}

export type SaveMarkdownInput = { expectedVersion: number; parentRevisionId: string; content: string }
export type SaveProposalInput = { expectedVersion: number; parentRevisionId: string; proposal: HarnessProposalV1; selectedItemIds: string[] }

export type HarnessClient = {
  load(inboxId: string): Promise<HarnessView>
  saveMarkdown(inboxId: string, input: SaveMarkdownInput): Promise<HarnessView>
  approveMarkdown(inboxId: string, input: { expectedVersion: number; markdownRevisionId: string; targetHash: string }): Promise<HarnessView>
  saveProposal(inboxId: string, input: SaveProposalInput): Promise<HarnessView>
  execute(inboxId: string, input: { expectedVersion: number; proposalRevisionId: string; targetHash: string; selectedItemIds: string[] }): Promise<HarnessView>
  retry(inboxId: string): Promise<HarnessView>
  discard(inboxId: string): Promise<HarnessView>
}

export function normalizeHarnessResponse(payload: unknown): HarnessView {
  const envelope = payload as { harness?: Record<string, unknown> }
  const raw = (envelope?.harness ?? payload) as Record<string, any>
  if (!raw || typeof raw !== 'object') throw new ApiError(0, 'Resposta inválida do estado da IA.')
  if (raw.run && 'markdownRevision' in raw && 'proposalRevision' in raw) return raw as HarnessView

  const proposal = raw.proposal as Record<string, any> | null | undefined
  const validatedPlan = proposal?.validatedPlan as HarnessProposalV1 | undefined
  const selectedItemIds = Array.isArray(proposal?.selectedItemIds)
    ? proposal.selectedItemIds
    : Array.isArray(proposal?.items)
      ? proposal.items.filter((item: any) => item.selected !== false).map((item: any) => item.localKey ?? item.id)
      : validatedPlan?.items.map((item) => item.id) ?? []

  return {
    run: {
      id: String(raw.id),
      status: raw.status as HarnessRunStatus,
      version: Number(raw.version),
      failedStep: (raw.failedStep ?? null) as HarnessRunStatus | null,
      errorCode: raw.errorCode ?? null,
      retryable: Boolean(raw.retryable),
      attempt: raw.jobs?.[0]?.attempts ?? null,
      nextRetryAt: raw.jobs?.[0]?.runAt ?? null,
    },
    transcript: raw.transcript ? {
      id: String(raw.transcript.id),
      version: Number(raw.transcript.version ?? 1),
      text: String(raw.transcript.text ?? ''),
      source: raw.transcript.source === 'STT' ? 'STT' : 'TEXT',
    } : null,
    markdownRevision: raw.markdown ? {
      id: String(raw.markdown.id),
      version: Number(raw.markdown.version ?? 1),
      content: String(raw.markdown.content ?? ''),
      contentHash: String(raw.markdown.contentHash ?? ''),
      source: raw.markdown.source === 'USER' ? 'USER' : 'AI',
    } : null,
    proposalRevision: proposal && validatedPlan ? {
      id: String(proposal.id),
      version: Number(proposal.version ?? 1),
      contentHash: String(proposal.contentHash ?? ''),
      proposal: validatedPlan,
    } : null,
    selectedItemIds,
    permissions: raw.permissions,
  }
}

export const browserHarnessClient: HarnessClient = {
  load: (id) => getJson(`/api/inbox/${id}/harness`).then(normalizeHarnessResponse),
  saveMarkdown: async (id, input) => {
    await putJson(`/api/inbox/${id}/markdown-draft`, { expectedVersion: input.expectedVersion, content: input.content })
    return browserHarnessClient.load(id)
  },
  approveMarkdown: async (id, input) => {
    await postJson(`/api/inbox/${id}/markdown-approval`, {
      expectedVersion: input.expectedVersion,
      revisionId: input.markdownRevisionId,
      targetHash: input.targetHash,
    })
    return browserHarnessClient.load(id)
  },
  saveProposal: async (id, input) => {
    await putJson(`/api/inbox/${id}/proposal-draft`, {
      expectedVersion: input.expectedVersion,
      proposal: input.proposal,
      selectedItemIds: input.selectedItemIds,
    })
    return browserHarnessClient.load(id)
  },
  execute: async (id, input) => {
    await postJson(`/api/inbox/${id}/execution`, input)
    return browserHarnessClient.load(id)
  },
  retry: async (id) => {
    await postJson(`/api/inbox/${id}/retry`, {})
    return browserHarnessClient.load(id)
  },
  discard: async (id) => {
    await postJson(`/api/inbox/${id}/discard`, {})
    return browserHarnessClient.load(id)
  },
}

type HarnessReviewPanelProps = {
  inboxItem: InboxItem
  client?: HarnessClient
  notify: Notify
  onBack: () => void
  projects?: Project[]
  autosaveDelayMs?: number
}

export function HarnessReviewPanel({
  inboxItem,
  client = browserHarnessClient,
  notify,
  onBack,
  projects = [],
  autosaveDelayMs = 600,
}: HarnessReviewPanelProps) {
  const [view, setView] = useState<HarnessView | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoadError(null)
    client.load(inboxItem.id)
      .then((next) => { if (active) setView(next) })
      .catch((error) => { if (active) setLoadError(errorMessage(error, 'Não foi possível carregar esta entrada.')) })
    return () => { active = false }
  }, [client, inboxItem.id])

  useEffect(() => {
    if (!view || !isProcessing(view.run.status)) return
    const timer = window.setInterval(() => {
      client.load(inboxItem.id).then(setView).catch(() => undefined)
    }, 2_000)
    return () => window.clearInterval(timer)
  }, [client, inboxItem.id, view?.run.status])

  if (loadError) return <HarnessMessage title="Falha ao abrir revisão" description={loadError} onBack={onBack} />
  if (!view) return <HarnessMessage title="Carregando revisão" description="Buscando estado preservado desta entrada…" onBack={onBack} loading />

  if (view.run.status === 'PROCESSED') {
    return <HarnessMessage title="Entidades criadas" description="Proposta aprovada e executada por inteiro." onBack={onBack} success />
  }
  if (view.run.status === 'DISCARDED') {
    return <HarnessMessage title="Entrada descartada" description="Processamento cancelado. Nenhuma entidade foi criada." onBack={onBack} />
  }

  return <ConsolidatedHarnessReview
    view={view}
    client={client}
    inboxItem={inboxItem}
    notify={notify}
    onBack={onBack}
    onViewChange={setView}
    projects={projects}
    autosaveDelayMs={autosaveDelayMs}
  />
}

/**
 * Superfície única de revisão: processamento inline, conteúdo interpretado em
 * seção expansível, itens propostos editáveis e um único CTA final. As duas
 * confirmações internas (conteúdo e entidades) continuam existindo no servidor,
 * com hashes exatos, mas sem jargão visível.
 */
function ConsolidatedHarnessReview({ view, client, inboxItem, notify, onBack, onViewChange, projects, autosaveDelayMs }: {
  view: HarnessView
  client: HarnessClient
  inboxItem: InboxItem
  notify: Notify
  onBack: () => void
  onViewChange: (view: HarnessView) => void
  projects: Project[]
  autosaveDelayMs: number
}) {
  const [contentDirty, setContentDirty] = useState(false)
  const [proposalDirty, setProposalDirty] = useState(false)
  const autoApprovedMarkdownRef = useRef<string | null>(null)
  const status = view.run.status
  const markdownStage = status === 'AWAITING_MARKDOWN_APPROVAL'
  const proposalStage = status === 'AWAITING_ENTITY_APPROVAL'
  const processing = isProcessing(status)
  const failed = status === 'FAILED'
  const markdownRevision = view.markdownRevision
  const needsAutomaticApproval = markdownStage && Boolean(markdownRevision) && markdownRevision?.source !== 'USER'

  useEffect(() => {
    if (!needsAutomaticApproval || !markdownRevision || autoApprovedMarkdownRef.current === markdownRevision.id) return
    autoApprovedMarkdownRef.current = markdownRevision.id
    client.approveMarkdown(inboxItem.id, {
      expectedVersion: view.run.version,
      markdownRevisionId: markdownRevision.id,
      targetHash: markdownRevision.contentHash,
    }).then(onViewChange).catch((error) => {
      autoApprovedMarkdownRef.current = null
      notify(errorMessage(error, 'Não foi possível preparar o resultado da IA.'), 'error')
    })
  }, [client, inboxItem.id, markdownRevision, needsAutomaticApproval, notify, onViewChange, view.run.version])

  return <div className="context-page harness-page">
    <HarnessBackButton dirty={contentDirty || proposalDirty} onBack={onBack} />
    <PageHeading
      level="section"
      className="context-heading"
      eyebrow="REVISÃO IA"
      title="Revisão da entrada"
      subtitle="Acompanhe o processamento e edite conteúdo e itens propostos nesta tela. Nada é criado antes do botão final."
    />
    {processing && <InlineProcessingBanner view={view} client={client} inboxItem={inboxItem} onViewChange={onViewChange} notify={notify} />}
    {failed && <InlineFailedBanner view={view} client={client} inboxItem={inboxItem} onViewChange={onViewChange} notify={notify} />}
    <div className="harness-split">
      <aside className="harness-context-panel">
        <HarnessContextPanel view={view} inboxItem={inboxItem} />
      </aside>
      <div className="harness-main-col">
        {markdownRevision && (markdownStage
          ? markdownRevision.source === 'USER'
            ? <MarkdownContentEditor
              view={view}
              client={client}
              inboxItem={inboxItem}
              notify={notify}
              onViewChange={onViewChange}
              onDirtyChange={setContentDirty}
              autosaveDelayMs={autosaveDelayMs}
            />
            : <AutomaticContentPanel view={view} />
          : <MarkdownContentPanel view={view} client={client} inboxItem={inboxItem} notify={notify} onViewChange={onViewChange} />)}
        {proposalStage && view.proposalRevision && <ProposalReviewSection
          view={view}
          client={client}
          inboxItem={inboxItem}
          notify={notify}
          onViewChange={onViewChange}
          projects={projects}
          onDirtyChange={setProposalDirty}
          autosaveDelayMs={autosaveDelayMs}
        />}
      </div>
    </div>
  </div>

/**
 * Coluna de contexto da revisão (painel dividido): a fonte original fica
 * sempre visível ao lado da decisão — transcrição, origem e, quando a
 * proposta existe, as evidências e duplicidades agregadas dos itens.
 */
function HarnessContextPanel({ view, inboxItem }: { view: HarnessView; inboxItem: InboxItem }) {
  const transcriptText = view.transcript?.text ?? inboxItem.text
  const proposal = view.proposalRevision?.proposal

  const evidence = useMemo(() => {
    if (!proposal) return []
    const seen = new Set<string>()
    const quotes: string[] = []
    for (const item of proposal.items) {
      for (const entry of item.evidence) {
        if (!seen.has(entry.quote)) { seen.add(entry.quote); quotes.push(entry.quote) }
      }
    }
    return quotes
  }, [proposal])

  const duplicates = useMemo(() => {
    if (!proposal) return []
    const seen = new Set<string>()
    const candidates: string[] = []
    for (const item of proposal.items) {
      for (const candidate of item.duplicateCandidates) {
        if (!seen.has(candidate)) { seen.add(candidate); candidates.push(candidate) }
      }
    }
    return candidates
  }, [proposal])

  return <section className="harness-context">
    <div className="hcp-heading"><FileText size={19} /><strong>Entrada original</strong></div>
    <div className="hcp-block">
      <small>Origem</small>
      <span className="hcp-origin"><FileAudio size={15} />{inboxItem.source} · {inboxItem.date}</span>
    </div>
    {transcriptText && <div className="hcp-block">
      <small>Transcrição</small>
      <p className="hcp-transcript">{transcriptText}</p>
    </div>}
    {evidence.length > 0 && <div className="hcp-block">
      <small>Por que essa classificação?</small>
      <div className="hcp-evidence">{evidence.map((quote) => <p key={quote}><CheckCircle size={15} weight="fill" />{quote}</p>)}</div>
    </div>}
    {duplicates.length > 0 && <div className="hcp-block">
      <small>Possível duplicidade</small>
      <div className="hcp-duplicates">{duplicates.map((candidate) => <span key={candidate}>{candidate}</span>)}</div>
    </div>}
  </section>
}
}

function AutomaticContentPanel({ view }: { view: HarnessView }) {
  const revision = view.markdownRevision
  if (!revision) return null
  return <section className="harness-collapse view-panel open" aria-live="polite">
    <header className="harness-collapse-heading">
      <NotePencil size={18} /><h2>Conteúdo interpretado</h2><SaveIndicator state="saving" />
    </header>
    <div className="harness-content-preview"><MarkdownPreview content={revision.content} /></div>
    <small className="harness-auto-note">Preparando o resultado final da IA…</small>
  </section>
}

function InlineProcessingBanner({ view, client, inboxItem, onViewChange, notify }: {
  view: HarnessView
  client: HarnessClient
  inboxItem: InboxItem
  onViewChange: (view: HarnessView) => void
  notify: Notify
}) {
  const [discarding, setDiscarding] = useState(false)
  async function discard() {
    setDiscarding(true)
    try {
      const next = await client.discard(inboxItem.id)
      onViewChange(next)
      notify('Entrada descartada.', 'info')
    } catch (error) {
      notify(errorMessage(error, 'Não foi possível descartar.'), 'error')
    } finally {
      setDiscarding(false)
    }
  }
  return <section className="harness-inline-status view-panel" role="status">
    <SpinnerGap className="harness-spinner" size={22} />
    <div><h2>{processingLabel(view.run.status)}</h2><p>{retryDescription(view)}</p></div>
    <Button variant="danger" icon={<Trash size={16} />} disabled={discarding} onClick={discard}>{discarding ? 'Descartando…' : 'Descartar entrada'}</Button>
  </section>
}

function InlineFailedBanner({ view, client, inboxItem, onViewChange, notify }: {
  view: HarnessView
  client: HarnessClient
  inboxItem: InboxItem
  onViewChange: (view: HarnessView) => void
  notify: Notify
}) {
  const [retrying, setRetrying] = useState(false)
  async function retry() {
    setRetrying(true)
    try {
      const next = await client.retry(inboxItem.id)
      onViewChange(next)
      notify('Nova tentativa iniciada.')
    } catch (error) {
      notify(errorMessage(error, 'Não foi possível tentar novamente.'), 'error')
    } finally {
      setRetrying(false)
    }
  }
  return <section className="harness-inline-status failed view-panel" role="alert">
    <WarningCircle size={22} />
    <div><h2>{failedStepMessage(view.run.failedStep)}</h2><p>Código: {view.run.errorCode ?? 'UNKNOWN_ERROR'}</p></div>
    {view.run.retryable && <Button variant="primary" disabled={retrying} onClick={retry}>{retrying ? 'Tentando…' : 'Tentar novamente'}</Button>}
  </section>
}

type EditorState = 'saved' | 'saving' | 'error' | 'conflict'

function MarkdownContentEditor({ view, client, inboxItem, notify, onViewChange, onDirtyChange, autosaveDelayMs }: {
  view: HarnessView
  client: HarnessClient
  inboxItem: InboxItem
  notify: Notify
  onViewChange: (view: HarnessView) => void
  onDirtyChange: (dirty: boolean) => void
  autosaveDelayMs: number
}) {
  const [content, setContent] = useState(view.markdownRevision!.content)
  const [savedContent, setSavedContent] = useState(view.markdownRevision!.content)
  const [saveState, setSaveState] = useState<EditorState>('saved')
  const [approving, setApproving] = useState(false)
  const [saveSequence, setSaveSequence] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const saveInFlightRef = useRef(false)
  const latestContentRef = useRef(content)
  const dirty = content !== savedContent
  latestContentRef.current = content

  useUnsavedWarning(dirty || saveState === 'saving')

  useEffect(() => {
    onDirtyChange(dirty || saveState === 'saving')
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange, saveState])

  useEffect(() => {
    if (!dirty || saveInFlightRef.current) return
    setSaveState('saving')
    const timer = window.setTimeout(() => {
      const parentRevisionId = view.markdownRevision!.id
      const savingContent = content
      let saved = false
      let hasNewerContent = false
      saveInFlightRef.current = true
      client.saveMarkdown(inboxItem.id, { expectedVersion: view.run.version, parentRevisionId, content: savingContent })
        .then((next) => {
          saved = true
          hasNewerContent = latestContentRef.current !== savingContent
          onViewChange(next)
          setSavedContent(savingContent)
          setSaveState(hasNewerContent ? 'saving' : 'saved')
        })
        .catch((error) => setSaveState(error instanceof ApiError && error.status === 409 ? 'conflict' : 'error'))
        .finally(() => {
          saveInFlightRef.current = false
          if (saved && hasNewerContent) setSaveSequence((current) => current + 1)
        })
    }, autosaveDelayMs)
    return () => window.clearTimeout(timer)
  }, [autosaveDelayMs, client, content, dirty, inboxItem.id, onViewChange, saveSequence, view.markdownRevision, view.run.version])

  function applyMarkdown(before: string, after = '') {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = content.slice(start, end)
    const next = `${content.slice(0, start)}${before}${selected}${after}${content.slice(end)}`
    setContent(next)
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(start + before.length, end + before.length)
    })
  }

  async function approve() {
    const revision = view.markdownRevision
    if (!revision || dirty || saveState !== 'saved') return
    setApproving(true)
    try {
      const next = await client.approveMarkdown(inboxItem.id, {
        expectedVersion: view.run.version,
        markdownRevisionId: revision.id,
        targetHash: revision.contentHash,
      })
      onViewChange(next)
      notify('Conteúdo aprovado. Gerando itens propostos.')
    } catch (error) {
      notify(errorMessage(error, 'Não foi possível continuar com este conteúdo.'), 'error')
    } finally {
      setApproving(false)
    }
  }

  return <section className="harness-collapse view-panel open">
    <header className="harness-collapse-heading">
      <NotePencil size={18} /><h2>Conteúdo interpretado</h2>
      <SaveIndicator state={saveState} />
    </header>
    <div className="harness-content-layout">
      <section className="review-column harness-editor-card">
        <div className="harness-editor-heading">
          <div className="markdown-toolbar" aria-label="Formatação">
            <button type="button" aria-label="Título" onClick={() => applyMarkdown('## ')}>H2</button>
            <button type="button" aria-label="Negrito" onClick={() => applyMarkdown('**', '**')}><b>B</b></button>
            <button type="button" aria-label="Lista" onClick={() => applyMarkdown('- ')}><ListBullets size={15} /></button>
            <button type="button" aria-label="Checklist" onClick={() => applyMarkdown('- [ ] ')}><Check size={15} /></button>
            <button type="button" aria-label="Link" onClick={() => applyMarkdown('[', '](https://)')}><LinkIcon size={15} /></button>
          </div>
        </div>
        <textarea ref={textareaRef} aria-label="Conteúdo interpretado" value={content} onChange={(event) => setContent(event.target.value)} />
        <small>Revisão {view.markdownRevision?.version} · {content.length.toLocaleString('pt-BR')} caracteres</small>
      </section>
      <section className="review-column harness-markdown-preview">
        <ColumnTitle icon={<MagicWand size={19} />} title="Visualização" />
        <MarkdownPreview content={content} />
      </section>
    </div>
    {saveState === 'conflict' && <InlineError>Outra revisão foi salva. Reabra a entrada para carregar a versão atual.</InlineError>}
    {saveState === 'error' && <InlineError>Não foi possível salvar. Edite novamente ou reabra quando a conexão voltar.</InlineError>}
    <footer className="review-footer">
      <span>O conteúdo revisado será usado para gerar os itens propostos. Nada será criado ainda.</span>
      <Button variant="primary" icon={<CheckCircle size={18} weight="fill" />} disabled={dirty || saveState !== 'saved' || approving} onClick={approve}>
        {approving ? 'Processando…' : 'Continuar'}
      </Button>
    </footer>
  </section>
}

/** Conteúdo já aprovado internamente: colapsado, com opção de reabrir para nova revisão. */
function MarkdownContentPanel({ view, client, inboxItem, notify, onViewChange }: {
  view: HarnessView
  client: HarnessClient
  inboxItem: InboxItem
  notify: Notify
  onViewChange: (view: HarnessView) => void
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const revision = view.markdownRevision!
  async function editContent() {
    if (editing) return
    setEditing(true)
    try {
      const next = await client.saveMarkdown(inboxItem.id, {
        expectedVersion: view.run.version,
        parentRevisionId: revision.id,
        content: revision.content,
      })
      onViewChange(next)
      notify('Conteúdo reaberto. Itens propostos serão recalculados.')
    } catch (error) {
      notify(errorMessage(error, 'Não foi possível reabrir o conteúdo.'), 'error')
    } finally {
      setEditing(false)
    }
  }
  return <section className="harness-collapse view-panel">
    <div className="harness-collapse-row">
      <button type="button" className="harness-collapse-toggle" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <NotePencil size={18} /><strong>Conteúdo interpretado</strong><span>{open ? 'Recolher' : 'Ver conteúdo'}</span>
      </button>
      {canReopenMarkdown(view) && <Button icon={<NotePencil size={16} />} disabled={editing} onClick={editContent}>
        {editing ? 'Abrindo…' : 'Editar conteúdo'}
      </Button>}
    </div>
    {open && <div className="harness-content-preview"><MarkdownPreview content={revision.content} /></div>}
  </section>
}

function ProposalReviewSection({ view, client, inboxItem, notify, onViewChange, projects, onDirtyChange, autosaveDelayMs }: {
  view: HarnessView
  client: HarnessClient
  inboxItem: InboxItem
  notify: Notify
  onViewChange: (view: HarnessView) => void
  projects: Project[]
  onDirtyChange: (dirty: boolean) => void
  autosaveDelayMs: number
}) {
  const [draft, setDraft] = useState(view.proposalRevision!.proposal)
  const [selected, setSelected] = useState(() => new Set(view.selectedItemIds))
  const [savedSignature, setSavedSignature] = useState(() => proposalSignature(view.proposalRevision!.proposal, view.selectedItemIds))
  const [saveState, setSaveState] = useState<EditorState>('saved')
  const [executing, setExecuting] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [saveSequence, setSaveSequence] = useState(0)
  const saveInFlightRef = useRef(false)
  const savePromiseRef = useRef<Promise<HarnessView> | null>(null)
  const autosaveTimerRef = useRef<number | null>(null)
  const proposalProjects = useMemo(() => getProposalProjectOptions(projects, draft), [draft, projects])
  const dependencyTitlesById = useMemo(() => {
    const titles = new Map<string, string>()
    for (const item of draft.items) titles.set(item.id, proposalItemTitle(item))
    return titles
  }, [draft.items])
  const selectedIds = draft.items.filter((item) => selected.has(item.id)).map((item) => item.id)
  const unresolvedGroups = groupUnresolvedItems(draft.unresolved)
  const signature = proposalSignature(draft, selectedIds)
  const latestProposalRef = useRef({ draft, selectedIds, signature })
  latestProposalRef.current = { draft, selectedIds, signature }
  const dirty = signature !== savedSignature
  const nextUserItemId = useMemo(() => {
    let max = 0
    for (const item of draft.items) {
      const match = /^user-item-(\d+)$/.exec(item.id)
      if (match) max = Math.max(max, Number(match[1]))
    }
    return `user-item-${max + 1}`
  }, [draft.items])

  useUnsavedWarning(dirty || saveState === 'saving')

  useEffect(() => {
    onDirtyChange(dirty || saveState === 'saving')
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange, saveState])

  useEffect(() => {
    if (!dirty || saveInFlightRef.current || executing || discarding) return
    setSaveState('saving')
    const timer = window.setTimeout(() => {
      autosaveTimerRef.current = null
      const proposal = draft
      const ids = proposal.items.filter((item) => selected.has(item.id)).map((item) => item.id)
      const savingSignature = proposalSignature(proposal, ids)
      let saved = false
      let hasNewerProposal = false
      saveInFlightRef.current = true
      const savePromise = client.saveProposal(inboxItem.id, {
        expectedVersion: view.run.version,
        parentRevisionId: view.proposalRevision!.id,
        proposal,
        selectedItemIds: ids,
      })
      savePromiseRef.current = savePromise
      savePromise.then((next) => {
        saved = true
        hasNewerProposal = latestProposalRef.current.signature !== savingSignature
        onViewChange(next)
        setSavedSignature(savingSignature)
        setSaveState(hasNewerProposal ? 'saving' : 'saved')
      }).catch((error) => setSaveState(error instanceof ApiError && error.status === 409 ? 'conflict' : 'error'))
        .finally(() => {
          saveInFlightRef.current = false
          if (savePromiseRef.current === savePromise) savePromiseRef.current = null
          if (saved && hasNewerProposal) setSaveSequence((current) => current + 1)
        })
    }, autosaveDelayMs)
    autosaveTimerRef.current = timer
    return () => {
      window.clearTimeout(timer)
      if (autosaveTimerRef.current === timer) autosaveTimerRef.current = null
    }
  }, [autosaveDelayMs, client, dirty, discarding, draft, executing, inboxItem.id, onViewChange, saveSequence, selected, view.proposalRevision, view.run.version])

  function patchItem(itemId: string, nextItem: HarnessProposalV1['items'][number]) {
    setDraft((current) => ({ ...current, items: current.items.map((item) => item.id === itemId ? nextItem : item) }))
  }

  function toggle(itemId: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  function addItem() {
    const project = proposalProjects[0]?.reference ?? draft.items.map(proposalProjectRef).find((reference): reference is ProposalProjectReference => Boolean(reference))
    if (!project || draft.items.length >= 100) return
    const item: HarnessProposalV1['items'][number] = {
      id: nextUserItemId,
      topicIds: ['user-added'],
      operation: 'CREATE',
      entity: 'TASK',
      dependsOn: [],
      evidence: [{ topicId: 'user-added', quote: 'Adicionado manualmente na revisão.' }],
      confidence: { type: 100 },
      duplicateCandidates: [],
      data: { project, title: 'Nova tarefa', status: 'BACKLOG' },
    }
    setDraft((current) => ({ ...current, items: [...current.items, item] }))
    setSelected((current) => new Set(current).add(item.id))
  }

  const canAddItem = Boolean(proposalProjects[0]?.reference ?? draft.items.map(proposalProjectRef).find(Boolean))

  async function execute() {
    const approvalSnapshot = latestProposalRef.current
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    setExecuting(true)
    try {
      let currentView = view
      const inFlight = savePromiseRef.current
      if (inFlight) {
        try {
          currentView = await inFlight
        } catch {
          currentView = await client.load(inboxItem.id)
          onViewChange(currentView)
        }
      } else if (saveState === 'error' || saveState === 'conflict') {
        currentView = await client.load(inboxItem.id)
        onViewChange(currentView)
      }

      let revision = currentView.proposalRevision
      if (!revision) throw new Error('Revisão da proposta indisponível.')
      const persistedSignature = proposalSignature(revision.proposal, currentView.selectedItemIds)
      if (persistedSignature !== approvalSnapshot.signature) {
        setSaveState('saving')
        try {
          currentView = await client.saveProposal(inboxItem.id, {
            expectedVersion: currentView.run.version,
            parentRevisionId: revision.id,
            proposal: approvalSnapshot.draft,
            selectedItemIds: approvalSnapshot.selectedIds,
          })
        } catch (error) {
          setSaveState(error instanceof ApiError && error.status === 409 ? 'conflict' : 'error')
          throw error
        }
        onViewChange(currentView)
        revision = currentView.proposalRevision
        if (!revision) throw new Error('Revisão salva não foi devolvida pelo servidor.')
      }
      setSavedSignature(approvalSnapshot.signature)
      setSaveState('saved')

      const next = await client.execute(inboxItem.id, {
        expectedVersion: currentView.run.version,
        proposalRevisionId: revision.id,
        targetHash: revision.contentHash,
        selectedItemIds: approvalSnapshot.selectedIds,
      })
      onViewChange(next)
      notify(approvalSnapshot.selectedIds.length
        ? `${approvalSnapshot.selectedIds.length} itens enviados para criação.`
        : 'Revisão concluída sem criar entidades.')
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) setSaveState('conflict')
      notify(errorMessage(error, 'Não foi possível criar os itens.'), 'error')
    } finally {
      setExecuting(false)
    }
  }

  async function discard() {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    setDiscarding(true)
    try {
      await savePromiseRef.current?.catch(() => undefined)
      const next = await client.discard(inboxItem.id)
      onViewChange(next)
      notify('Entrada descartada.', 'info')
    } catch (error) {
      notify(errorMessage(error, 'Não foi possível descartar.'), 'error')
    } finally {
      setDiscarding(false)
    }
  }

  return <>
    <section className="harness-proposal-summary view-panel">
      <div><MagicWand size={22} weight="duotone" /><p><strong>{draft.summary}</strong><span>{selectedIds.length} de {draft.items.length} itens selecionados</span></p></div>
      <SaveIndicator state={saveState} />
      <Button icon={<Plus size={16} />} disabled={!canAddItem || draft.items.length >= 100} onClick={addItem}>Adicionar item</Button>
      <span>Revisão {view.proposalRevision?.version}</span>
    </section>
    <section className="harness-proposal-grid">
      {draft.items.map((item) => <ProposalEntityCard
        key={item.id}
        item={item}
        projects={proposalProjects}
        selected={selected.has(item.id)}
        selectionLocked={draft.items.some((candidate) => selected.has(candidate.id) && candidate.dependsOn.includes(item.id))}
        dependencyTitles={item.dependsOn.map((id) => dependencyTitlesById.get(id) ?? id)}
        onToggle={() => toggle(item.id)}
        onChange={(next) => patchItem(item.id, next)}
      />)}
    </section>
    {unresolvedGroups.length > 0 && <section className="harness-unresolved view-panel">
      <header><WarningCircle size={19} /><strong>Conteúdo não resolvido</strong><span>{unresolvedGroups.length}</span></header>
      {unresolvedGroups.map((group) => <article key={group.key}>
        <b>{group.reason}</b>
        <p>{group.evidence.join(' · ')}</p>
        {group.topicIds.length > 1 && <small>{group.topicIds.length} tópicos agrupados</small>}
      </article>)}
    </section>}
    {saveState === 'conflict' && <InlineError>Proposta desatualizada. Criar itens recarrega a revisão antes de concluir.</InlineError>}
    {saveState === 'error' && <InlineError>Autosave incompleto. Criar itens tenta recuperar a revisão; descarte continua disponível.</InlineError>}
    <footer className="review-footer">
      <Button variant="danger" icon={<Trash size={17} />} disabled={executing || discarding} onClick={discard}>
        {discarding ? 'Descartando…' : 'Descartar entrada'}
      </Button>
      <span>{selectedIds.length
        ? `${selectedIds.length} ${selectedIds.length === 1 ? 'item será' : 'itens serão'} criados; não selecionados ficam fora da execução.`
        : 'Nenhuma entidade será criada; o conteúdo permanece não resolvido.'}</span>
      <Button variant="primary" icon={<CheckCircle size={18} weight="fill" />} disabled={executing || discarding} onClick={execute}>
        {executing ? (selectedIds.length ? 'Criando…' : 'Concluindo…') : (selectedIds.length ? `Criar ${selectedIds.length} ${selectedIds.length === 1 ? 'item' : 'itens'}` : 'Concluir sem criar itens')}
      </Button>
    </footer>
  </>
}


type UnresolvedGroup = {
  key: string
  reason: string
  evidence: string[]
  topicIds: string[]
}

function groupUnresolvedItems(items: HarnessProposalV1['unresolved']): UnresolvedGroup[] {
  const groups = new Map<string, UnresolvedGroup>()
  for (const item of items) {
    const evidence = item.evidence.map((entry) => entry.quote)
    const key = JSON.stringify([item.reason, evidence])
    const group = groups.get(key)
    if (group) {
      if (!group.topicIds.includes(item.topicId)) group.topicIds.push(item.topicId)
      continue
    }
    groups.set(key, { key, reason: item.reason, evidence, topicIds: [item.topicId] })
  }
  return [...groups.values()]
}

type ProposalProjectReference = { existingId: string } | { localId: string }
type ProposalProjectOption = { id: string; name: string; reference: ProposalProjectReference }

function getProposalProjectOptions(projects: Project[], proposal: HarnessProposalV1): ProposalProjectOption[] {
  const persisted = projects.map((project) => ({ id: project.id, name: project.name, reference: { existingId: project.id } as const }))
  const proposed = proposal.items
    .filter((item): item is Extract<HarnessProposalV1['items'][number], { entity: 'PROJECT' }> => item.entity === 'PROJECT')
    .map((project) => ({ id: project.id, name: project.data.name, reference: { localId: project.id } as const }))
  return [...new Map([...persisted, ...proposed].map((option) => [option.id, option])).values()]
}

function ProposalEntityCard({ item, projects, selected, selectionLocked, dependencyTitles, onToggle, onChange }: {
  item: HarnessProposalV1['items'][number]
  projects: ProposalProjectOption[]
  selected: boolean
  selectionLocked: boolean
  dependencyTitles: string[]
  onToggle: () => void
  onChange: (item: HarnessProposalV1['items'][number]) => void
}) {
  const title = proposalItemTitle(item)
  return <article className={`proposal-entity-card entity-${item.entity.toLowerCase()} ${selected ? 'selected' : 'excluded'}`}>
    <header className="proposal-card-head">
      <label className="proposal-toggle" title={selectionLocked ? 'Remova primeiro os itens que dependem deste.' : undefined}>
        <input type="checkbox" aria-label={`Incluir ${title}`} checked={selected} disabled={selectionLocked} onChange={onToggle} />
      </label>
      <span className="proposal-entity-chip">
        {proposalEntityIcon(item.entity)}
        {isPrimaryProposalEntity(item.entity)
          ? <select aria-label={`Tipo de ${title}`} value={item.entity} onChange={(event) => onChange(convertProposalEntity(item, event.target.value as PrimaryProposalEntity, projects[0]?.id))}>
            <option value="TASK">Tarefa</option><option value="MEETING">Reunião</option><option value="NOTE">Nota privada</option><option value="MILESTONE">Marco</option>
          </select>
          : <strong>{proposalEntityLabel(item.entity)}</strong>}
        {isPrimaryProposalEntity(item.entity) && <CaretDown size={11} aria-hidden="true" className="proposal-chip-caret" />}
      </span>
      <ConfidenceFields confidence={item.confidence} />
      {!selected && <span className="proposal-excluded-tag">Fica de fora</span>}
    </header>
    <ProposalEntityFields item={item} projects={projects} onChange={onChange} />
    {item.dependsOn.length > 0 && <small className="proposal-dependencies"><LinkIcon size={13} />Depende de: {dependencyTitles.join(', ')}</small>}
  </article>
}

function proposalEntityIcon(entity: HarnessProposalV1['items'][number]['entity']): ReactNode {
  if (entity === 'TASK') return <CheckCircle size={14} />
  if (entity === 'MEETING') return <CalendarBlank size={14} />
  if (entity === 'NOTE') return <NotePencil size={14} />
  if (entity === 'MILESTONE') return <Flag size={14} />
  if (entity === 'PROJECT') return <Archive size={14} />
  return null
}

function ProposalEntityFields({ item, projects, onChange }: {
  item: HarnessProposalV1['items'][number]
  projects: ProposalProjectOption[]
  onChange: (item: HarnessProposalV1['items'][number]) => void
}) {
  if (item.entity === 'TASK') {
    const patch = (data: Partial<typeof item.data>) => onChange({ ...item, data: { ...item.data, ...data } })
    const title = item.data.title
    return <>
      <input className="proposal-title-input" aria-label={`Título de ${title}`} placeholder="Título da tarefa" value={item.data.title} onChange={(event) => patch({ title: event.target.value })} />
      <div className="proposal-fields">
        <ProjectField value={item.data.project} projects={projects} onChange={(project) => patch({ project })} />
        <label>Módulo<input aria-label={`Módulo de ${title}`} value={item.data.moduleName ?? ''} onChange={(event) => patch({ moduleName: event.target.value || undefined })} /></label>
        <label>Tipo de demanda<select aria-label={`Tipo de demanda de ${title}`} value={item.data.kind ?? 'TASK'} onChange={(event) => patch({ kind: event.target.value as NonNullable<typeof item.data.kind> })}>
          <option value="TASK">Tarefa</option><option value="BUG">Bug</option><option value="IMPROVEMENT">Melhoria</option><option value="FEATURE">Funcionalidade</option><option value="DECISION">Decisão</option><option value="EXTERNAL_REQUEST">Solicitação externa</option><option value="FUTURE_IDEA">Ideia futura</option><option value="QUESTION">Pergunta</option>
        </select></label>
        <label>Status<select aria-label={`Status de ${title}`} value={item.data.status ?? 'BACKLOG'} onChange={(event) => patch({ status: event.target.value as NonNullable<typeof item.data.status> })}>
          <option value="BACKLOG">Backlog</option><option value="IN_PROGRESS">Em andamento</option><option value="BLOCKED">Bloqueada</option><option value="IN_REVIEW">Em validação</option><option value="COMPLETED">Concluída</option><option value="CANCELED">Cancelada</option>
        </select></label>
        <label>Prioridade<select aria-label={`Prioridade de ${title}`} value={item.data.priority ?? 'P2'} onChange={(event) => patch({ priority: event.target.value as NonNullable<typeof item.data.priority> })}>
          {['P0', 'P1', 'P2', 'P3'].map((priority) => <option key={priority}>{priority}</option>)}
        </select></label>
        <label>Complexidade<select aria-label={`Complexidade de ${title}`} value={item.data.complexity ?? ''} onChange={(event) => patch({ complexity: event.target.value ? Number(event.target.value) : null })}>
          <option value="">Não informada</option><option value="1">Baixa</option><option value="2">Média</option><option value="3">Alta</option>
        </select></label>
        <label>Prazo<input aria-label={`Prazo de ${title}`} type="datetime-local" value={dateTimeInput(item.data.dueAt)} onChange={(event) => patch({ dueAt: dateTimeOutput(event.target.value) })} /></label>
        <label>Previsão<input aria-label={`Previsão de ${title}`} type="datetime-local" value={dateTimeInput(item.data.forecastAt)} onChange={(event) => patch({ forecastAt: dateTimeOutput(event.target.value) })} /></label>
        <label className="proposal-wide">Tags<input aria-label={`Tags de ${title}`} value={(item.data.tags ?? []).join(', ')} onChange={(event) => patch({ tags: commaValues(event.target.value) })} placeholder="Ex.: mensal, diretoria" /></label>
        <label className="proposal-wide">Marcos<input aria-label={`Marcos de ${title}`} value={referenceListInput(item.data.milestones)} onChange={(event) => patch({ milestones: referenceListOutput(event.target.value) })} placeholder="IDs separados por vírgula; use local:id para itens desta proposta" /></label>
        <label className="proposal-wide">Descrição<textarea value={item.data.description ?? ''} onChange={(event) => patch({ description: event.target.value })} /></label>
      </div>
    </>
  }
  if (item.entity === 'MEETING') {
    const patch = (data: Partial<typeof item.data>) => onChange({ ...item, data: { ...item.data, ...data } })
    return <>
      <input className="proposal-title-input" aria-label={`Título de ${item.data.title}`} placeholder="Título da reunião" value={item.data.title} onChange={(event) => patch({ title: event.target.value })} />
      <div className="proposal-fields">
        <label>Projeto opcional<input value={item.data.project ? projectRefValue(item.data.project) : ''} onChange={(event) => patch({ project: event.target.value ? { existingId: event.target.value } : undefined })} /></label>
        <label>Início<input type="datetime-local" value={dateTimeInput(item.data.startsAt)} onChange={(event) => patch({ startsAt: dateTimeOutput(event.target.value) ?? item.data.startsAt })} /></label>
        <label>Fim<input type="datetime-local" value={dateTimeInput(item.data.endsAt)} onChange={(event) => patch({ endsAt: dateTimeOutput(event.target.value) ?? undefined })} /></label>
        <label>Duração em minutos<input type="number" min="1" max="1440" value={item.data.durationMinutes ?? ''} onChange={(event) => patch({ durationMinutes: event.target.value ? Number(event.target.value) : undefined })} /></label>
        <label>Fuso<input value={item.data.timezone} onChange={(event) => patch({ timezone: event.target.value })} /></label>
        <label>Link<input type="url" value={item.data.link ?? ''} onChange={(event) => patch({ link: event.target.value || undefined })} /></label>
        <label className="proposal-wide">Descrição<textarea value={item.data.description ?? ''} onChange={(event) => patch({ description: event.target.value })} /></label>
      </div>
    </>
  }
  if (item.entity === 'NOTE') {
    const patch = (data: Partial<typeof item.data>) => onChange({ ...item, data: { ...item.data, ...data } })
    return <>
      <input className="proposal-title-input" aria-label={`Título de ${item.data.title}`} placeholder="Título da nota" value={item.data.title} onChange={(event) => patch({ title: event.target.value })} />
      <div className="proposal-fields">
        <ProjectField value={item.data.project} projects={projects} onChange={(project) => patch({ project })} />
        <label>Task opcional<input value={item.data.task ? projectRefValue(item.data.task) : ''} onChange={(event) => patch({ task: event.target.value ? { existingId: event.target.value } : undefined })} /></label>
        <label>Privacidade<input value="Privada" readOnly aria-readonly="true" /></label>
        <label className="proposal-wide">Conteúdo<textarea value={item.data.content} onChange={(event) => patch({ content: event.target.value })} /></label>
      </div>
    </>
  }
  if (item.entity === 'MILESTONE') {
    const patch = (data: Partial<typeof item.data>) => onChange({ ...item, data: { ...item.data, ...data } })
    return <>
      <input className="proposal-title-input" aria-label={`Nome de ${item.data.name}`} placeholder="Nome do marco" value={item.data.name} onChange={(event) => patch({ name: event.target.value })} />
      <div className="proposal-fields">
        <ProjectField value={item.data.project} projects={projects} onChange={(project) => patch({ project })} />
        <label>Início<input type="datetime-local" value={dateTimeInput(item.data.startAt)} onChange={(event) => patch({ startAt: dateTimeOutput(event.target.value) })} /></label>
        <label>Data-alvo<input type="datetime-local" value={dateTimeInput(item.data.targetAt)} onChange={(event) => patch({ targetAt: dateTimeOutput(event.target.value) ?? item.data.targetAt })} /></label>
        <label>Status<select value={item.data.status ?? 'PLANNED'} onChange={(event) => patch({ status: event.target.value as NonNullable<typeof item.data.status> })}>
          <option value="PLANNED">Planejado</option><option value="IN_PROGRESS">Em andamento</option><option value="ACHIEVED">Atingido</option><option value="POSTPONED">Adiado</option><option value="CANCELED">Cancelado</option>
        </select></label>
        <label className="proposal-wide">Tasks vinculadas<input value={referenceListInput(item.data.tasks)} onChange={(event) => patch({ tasks: referenceListOutput(event.target.value) })} placeholder="IDs separados por vírgula; use local:id" /></label>
        <label className="proposal-wide">Descrição<textarea value={item.data.description ?? ''} onChange={(event) => patch({ description: event.target.value })} /></label>
      </div>
    </>
  }
  return <p className="proposal-aux-title">{proposalItemTitle(item)}</p>
}

function ProjectField({ value, projects, onChange }: { value: ProposalProjectReference; projects: ProposalProjectOption[]; onChange: (value: ProposalProjectReference) => void }) {
  return <label>Projeto{projects.length
    ? <select value={projectRefValue(value)} onChange={(event) => {
      const selected = projects.find((project) => project.id === event.target.value)
      if (selected) onChange(selected.reference)
    }}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
    : <input value={projectRefValue(value)} onChange={(event) => onChange({ existingId: event.target.value })} />}</label>
}

function HarnessMessage({ title, description, onBack, loading = false, success = false }: { title: string; description: string; onBack: () => void; loading?: boolean; success?: boolean }) {
  return <div className="context-page harness-page">
    <button className="back-context" onClick={onBack}><ArrowLeft size={17} /> Voltar para fila</button>
    <section className={`harness-status-page ${success ? 'success' : ''}`}>
      {loading ? <SpinnerGap className="harness-spinner" size={35} /> : success ? <CheckCircle size={35} weight="fill" /> : <WarningCircle size={35} />}
      <h1>{title}</h1><p>{description}</p>
    </section>
  </div>
}

function SaveIndicator({ state }: { state: EditorState }) {
  const labels: Record<EditorState, string> = { saved: 'Salvo', saving: 'Salvando…', error: 'Erro ao salvar', conflict: 'Conflito de versão' }
  return <span className={`harness-save-state ${state}`} aria-live="polite">{state === 'saved' ? <FloppyDisk size={15} /> : state === 'saving' ? <SpinnerGap size={15} /> : <WarningCircle size={15} />}{labels[state]}</span>
}

function canReopenMarkdown(view: HarnessView) {
  if (!view.markdownRevision) return false
  if (view.permissions) return view.permissions.editMarkdown
  return ['RETRIEVING_REFERENCES', 'MATERIALIZING', 'AWAITING_ENTITY_APPROVAL', 'FAILED'].includes(view.run.status)
}

function HarnessBackButton({ dirty, onBack }: { dirty: boolean; onBack: () => void }) {
  function leave() {
    if (!dirty || window.confirm('Há alterações ainda não salvas. Sair mesmo assim?')) onBack()
  }
  return <button className="back-context" onClick={leave}><ArrowLeft size={17} /> Voltar para fila</button>
}

function MarkdownPreview({ content }: { content: string }) {
  const lines = content.replaceAll('\r\n', '\n').split('\n')
  return <div className="markdown-render" aria-label="Visualização do conteúdo">{lines.map((line, index) => {
    const key = `${index}-${line}`
    if (line.startsWith('### ')) return <h3 key={key}>{inlineMarkdown(line.slice(4))}</h3>
    if (line.startsWith('## ')) return <h2 key={key}>{inlineMarkdown(line.slice(3))}</h2>
    if (line.startsWith('# ')) return <h1 key={key}>{inlineMarkdown(line.slice(2))}</h1>
    const checklist = line.match(/^- \[([ xX])\] (.*)$/)
    if (checklist) return <p className="markdown-check" key={key}><input type="checkbox" checked={checklist[1].toLowerCase() === 'x'} readOnly />{inlineMarkdown(checklist[2])}</p>
    if (line.startsWith('- ')) return <p className="markdown-list" key={key}>• {inlineMarkdown(line.slice(2))}</p>
    if (!line.trim()) return <br key={key} />
    return <p key={key}>{inlineMarkdown(line)}</p>
  })}</div>
}

function InlineError({ children }: { children: ReactNode }) {
  return <div className="harness-inline-error" role="alert"><WarningCircle size={17} />{children}</div>
}

function inlineMarkdown(value: string): ReactNode[] {
  const parts = value.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^\s)]+\))/g).filter(Boolean)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) {
      const safe = /^(https?:|mailto:)/i.test(link[2]) ? link[2] : '#'
      return <a key={index} href={safe} rel="noreferrer">{link[1]}</a>
    }
    return part
  })
}

function ColumnTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return <div className="column-title">{icon}<h2>{title}</h2></div>
}

function ConfidenceFields({ confidence }: { confidence: HarnessProposalV1['items'][number]['confidence'] }) {
  const values = Object.values(confidence).filter((value): value is number => typeof value === 'number')
  const lowest = Math.min(...values)
  return <span className={`proposal-confidence ${lowest < 70 ? 'uncertain' : ''}`} title={`Confiança da classificação: ${lowest}%`} aria-label={`Confiança ${lowest}%`}>
    <span className="proposal-confidence-track" aria-hidden="true"><i style={{ width: `${lowest}%` }} /></span>
    {lowest}%
  </span>
}

function useUnsavedWarning(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [enabled])
}

function proposalSignature(proposal: HarnessProposalV1, selectedIds: string[]) {
  return JSON.stringify({ proposal, selectedIds })
}

function proposalItemTitle(item: HarnessProposalV1['items'][number]) {
  if (item.entity === 'TASK' || item.entity === 'MEETING' || item.entity === 'NOTE' || item.entity === 'CONTEXT') return item.data.title
  if (item.entity === 'MILESTONE') return item.data.name
  if (item.entity === 'PROJECT') return item.data.name
  if (item.entity === 'ALIAS') return item.data.value
  if (item.entity === 'MODULE' || item.entity === 'TAG') return item.data.name
  return item.entity === 'DEPENDENCY' ? 'Dependência entre tarefas' : 'Vínculo de tarefa e marco'
}

function proposalEntityLabel(entity: HarnessProposalV1['items'][number]['entity']) {
  return ({ TASK: 'Tarefa', MEETING: 'Reunião', NOTE: 'Nota privada', MILESTONE: 'Marco', PROJECT: 'Projeto', ALIAS: 'Alias', MODULE: 'Módulo', TAG: 'Tag', CONTEXT: 'Contexto', DEPENDENCY: 'Dependência', TASK_MILESTONE: 'Vínculo com marco' })[entity]
}

type PrimaryProposalEntity = 'TASK' | 'MEETING' | 'NOTE' | 'MILESTONE'

function isPrimaryProposalEntity(entity: HarnessProposalV1['items'][number]['entity']): entity is PrimaryProposalEntity {
  return entity === 'TASK' || entity === 'MEETING' || entity === 'NOTE' || entity === 'MILESTONE'
}

function convertProposalEntity(item: HarnessProposalV1['items'][number], entity: PrimaryProposalEntity, fallbackProjectId?: string): HarnessProposalV1['items'][number] {
  if (item.entity === entity) return item
  const project = proposalProjectRef(item) ?? { existingId: fallbackProjectId ?? '' }
  const title = proposalItemTitle(item)
  const description = proposalDescription(item)
  const common = {
    id: item.id,
    topicIds: item.topicIds,
    operation: item.operation,
    dependsOn: item.dependsOn,
    evidence: item.evidence,
    confidence: item.confidence,
    duplicateCandidates: item.duplicateCandidates,
  }
  if (entity === 'TASK') return { ...common, entity, data: { project, title, description, status: 'BACKLOG' } }
  if (entity === 'NOTE') return { ...common, entity, data: { project, title, content: description || title, private: true } }
  if (entity === 'MEETING') return { ...common, entity, data: { project, title, description, startsAt: '', durationMinutes: 30, timezone: 'America/Sao_Paulo' } }
  return { ...common, entity, data: { project, name: title, description, targetAt: '', status: 'PLANNED' } }
}

function proposalProjectRef(item: HarnessProposalV1['items'][number]) {
  return 'project' in item.data ? item.data.project : undefined
}

function proposalDescription(item: HarnessProposalV1['items'][number]) {
  if (item.entity === 'TASK' || item.entity === 'MEETING' || item.entity === 'MILESTONE' || item.entity === 'PROJECT') return item.data.description ?? ''
  if (item.entity === 'NOTE' || item.entity === 'CONTEXT') return item.data.content
  return ''
}

function projectRefValue(ref: { existingId: string } | { localId: string }) {
  return 'existingId' in ref ? ref.existingId : ref.localId
}

function dateTimeInput(value: string | null | undefined) {
  return value ? value.slice(0, 16) : ''
}

function dateTimeOutput(value: string) {
  return value ? `${value}:00-03:00` : null
}

function commaValues(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function referenceListInput(refs: Array<{ existingId: string } | { localId: string }> | undefined) {
  return (refs ?? []).map((ref) => 'existingId' in ref ? ref.existingId : `local:${ref.localId}`).join(', ')
}

function referenceListOutput(value: string): Array<{ existingId: string } | { localId: string }> {
  return commaValues(value).map((id) => id.startsWith('local:') ? { localId: id.slice(6) } : { existingId: id })
}

function isProcessing(status: HarnessRunStatus) {
  return ['RECEIVED', 'TRANSCRIBING', 'TRANSCRIBED', 'ORGANIZING', 'RETRIEVING_REFERENCES', 'MATERIALIZING', 'EXECUTING'].includes(status)
}

function processingLabel(status: HarnessRunStatus) {
  return ({
    RECEIVED: 'Entrada recebida',
    TRANSCRIBING: 'Transcrevendo áudio',
    TRANSCRIBED: 'Transcrição concluída',
    ORGANIZING: 'Organizando conteúdo',
    RETRIEVING_REFERENCES: 'Buscando referências existentes',
    MATERIALIZING: 'Montando proposta consolidada',
    EXECUTING: 'Criando entidades em etapas',
  } as Partial<Record<HarnessRunStatus, string>>)[status] ?? 'Processando entrada'
}

function failedStepMessage(step: HarnessRunStatus | null) {
  if (step === 'TRANSCRIBING') return 'Não foi possível transcrever o áudio agora.'
  if (step === 'ORGANIZING') return 'Não foi possível organizar o conteúdo agora.'
  if (step === 'RETRIEVING_REFERENCES') return 'Não foi possível buscar referências agora.'
  if (step === 'MATERIALIZING') return 'Não foi possível montar a proposta agora.'
  if (step === 'EXECUTING') return 'Não foi possível criar as entidades.'
  return 'Não foi possível concluir esta etapa.'
}

function retryDescription(view: HarnessView) {
  if (view.run.nextRetryAt) return `Tentativa ${view.run.attempt ?? 1}. Próxima tentativa automática: ${new Date(view.run.nextRetryAt).toLocaleString('pt-BR')}.`
  return `Tentativa ${view.run.attempt ?? 1}. Estado preservado; recarregar a página não perde progresso.`
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.detail : error instanceof Error ? error.message : fallback
}
