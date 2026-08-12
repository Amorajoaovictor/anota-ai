import {
  ArrowLeft,
  CheckCircle,
  FileAudio,
  FileText,
  Lightbulb,
  MagicWand,
  Microphone,
  PaperPlaneTilt,
  SpinnerGap,
  Sparkle,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  complexities,
  pendingInboxStatuses,
  type AppState,
  type Complexity,
  type ContextSuggestion,
  type EntryKind,
  type InboxItem,
  type Priority,
} from './domain'
import { HarnessReviewPanel } from './aiHarnessFlow'
import type { ProjectActions } from './lib/store'
import type { AiPlan, AiPlanAction } from './server/ai/plan'
import { Button, EmptyState, PageHeading, type BadgeTone, type Notify } from './ui'

type ContextFlowProps = {
  state: AppState
  setState: (state: AppState) => void
  actions: ProjectActions
  notify: Notify
}

const kinds: EntryKind[] = [
  'Tarefa',
  'Bug',
  'Melhoria',
  'Funcionalidade',
  'Decisão',
  'Solicitação externa',
  'Ideia futura',
  'Pergunta',
]
const priorities: Priority[] = ['P0', 'P1', 'P2', 'P3']

/** Enquanto houver item em processamento, busca o resultado do job a cada 2s. Para sozinho quando não sobra nenhum. */
function useInboxPolling(state: AppState, actions: ProjectActions) {
  useEffect(() => {
    const hasPending = state.inbox.some((item) => pendingInboxStatuses.includes(item.status))
    if (!hasPending) return
    const timer = setInterval(() => { void actions.refreshInbox() }, 2000)
    return () => clearInterval(timer)
  }, [state.inbox, actions])
}

/** Grava com `MediaRecorder` nativo do browser — sem dependência nova. */
function useAudioRecorder(onStop: (blob: Blob) => void) {
  const [recording, setRecording] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream)
    chunksRef.current = []
    recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data) }
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop())
      onStop(new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' }))
    }
    recorder.start()
    recorderRef.current = recorder
    setRecording(true)
  }

  function stop() {
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
  }

  return { recording, start, stop }
}

export function SmartInboxView(props: ContextFlowProps) {
  const { state, actions, notify } = props
  const [text, setText] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recorder = useAudioRecorder((blob) => {
    void actions.captureInboxAudio(blob).then((id) => { if (id) setSelectedId(id) })
  })
  useInboxPolling(state, actions)

  const selected = state.inbox.find((item) => item.id === selectedId)
  const active = state.inbox.filter((item) => item.status !== 'Descartada')

  if (selected) {
    return <ContextReviewPanel {...props} item={selected} onBack={() => setSelectedId(null)} />
  }

  function captureAndAnalyze() {
    const clean = text.trim()
    if (!clean) return
    void actions.captureInbox(clean).then((id) => { if (id) setSelectedId(id) })
    setText('')
  }

  function toggleRecording() {
    if (recorder.recording) { recorder.stop(); return }
    recorder.start().catch(() => notify('Não foi possível acessar o microfone.', 'error'))
  }

  function pickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) void actions.captureInboxAudio(file).then((id) => { if (id) setSelectedId(id) })
    event.target.value = ''
  }

  return <div className="context-page">
    <PageHeading
      level="section"
      className="context-heading"
      eyebrow="CAPTURA SUPERVISIONADA"
      title="Caixa de entrada inteligente"
      subtitle="Registre em texto ou áudio. Você revisa o resultado e confirma antes de qualquer criação."
    />

    <section className="capture-hub view-panel">
      <div className="capture-copy">
        <Sparkle size={22} weight="duotone" />
        <div>
          <strong>O que aconteceu?</strong>
          <span>Descreva uma demanda, reunião, decisão, bloqueio ou ideia sem preencher formulário.</span>
        </div>
      </div>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Ex.: A planta principal continua carregando automaticamente e travando o mapa. Coloca isso como prioridade alta."
      />
      <div className="capture-actions">
        <div>
          <button className="input-mode active" type="button"><FileText size={17} /> Texto</button>
          <button className={`input-mode ${recorder.recording ? 'active' : ''}`} type="button" onClick={toggleRecording}>
            <Microphone size={17} weight={recorder.recording ? 'fill' : 'regular'} /> {recorder.recording ? 'Parar gravação' : 'Gravar áudio'}
          </button>
          <button className="input-mode" type="button" onClick={() => fileInputRef.current?.click()}><FileAudio size={17} /> Enviar arquivo</button>
          <input ref={fileInputRef} type="file" accept="audio/*" hidden onChange={pickFile} />
        </div>
        <Button variant="primary" className="capture-submit" disabled={!text.trim()} onClick={captureAndAnalyze} trailing={<PaperPlaneTilt size={17} weight="fill" />}>
          Organizar com IA
        </Button>
      </div>
    </section>

    <section className="context-list">
      <div className="context-list-heading">
        <div>
          <h2>Entradas recentes</h2>
          <span>{active.filter((item) => item.status === 'Aguardando confirmação').length} aguardando sua confirmação</span>
        </div>
        <span className="queue-count">{active.length}</span>
      </div>
      {active.map((item) => <InboxCard key={item.id} item={item} onOpen={() => setSelectedId(item.id)} />)}
    </section>
  </div>
}

export function ContextReviewQueue(props: ContextFlowProps) {
  const { state, actions } = props
  const [selectedId, setSelectedId] = useState<string | null>(null)
  useInboxPolling(state, actions)

  const pending = state.inbox.filter((item) => item.status === 'Aguardando confirmação' || (
    !item.suggestion && item.status !== 'Processada' && item.status !== 'Descartada'
  ))
  const selected = pending.find((item) => item.id === selectedId)

  if (selected) {
    return <ContextReviewPanel {...props} item={selected} onBack={() => setSelectedId(null)} />
  }

  return <div className="context-page">
    <PageHeading
      level="section"
      className="context-heading"
      eyebrow="REVISÃO IA"
      title="Revisão IA"
      subtitle="Revise conteúdo e itens propostos nesta fila antes de criar entidades."
    />
    <div className="review-overview view-panel">
      <div className="review-score"><MagicWand size={27} weight="duotone" /><div><strong>{pending.length} propostas</strong><span>aguardando decisão</span></div></div>
      <p>Nenhuma entidade é criada antes da sua confirmação final. Estado e correções permanecem após recarregar.</p>
    </div>
    <section className="context-list review-list">
      {pending.length
        ? pending.map((item) => <InboxCard key={item.id} item={item} onOpen={() => setSelectedId(item.id)} />)
        : <EmptyState icon={<CheckCircle size={34} weight="duotone" />} title="Revisão em dia" description="Novos Markdown e previews aparecerão aqui." />}
    </section>
  </div>
}

function InboxCard({ item, onOpen }: { item: InboxItem; onOpen: () => void }) {
  const suggestion = item.suggestion
  const processed = item.status === 'Processada'
  const errored = item.status === 'Com erro'
  const pending = pendingInboxStatuses.includes(item.status)
  return <article className="context-card">
    <div className="context-source-icon">{item.source === 'Áudio' ? <FileAudio size={20} /> : <FileText size={20} />}</div>
    <div className="context-card-main">
      <div className="context-card-top">
        <StatusBadge status={item.status} />
        <span>{item.source} · {item.date}</span>
      </div>
      <p>{item.text || <em>Aguardando transcrição do áudio…</em>}</p>
      {suggestion && (isAiPlanSuggestion(suggestion)
        ? <div className="suggestion-preview">
          <span><b>{suggestion.actions.length} ações propostas</b></span>
          <span>{suggestion.actions.filter((action) => action.entity === 'context').length} contextos</span>
          <Confidence value={suggestion.confidence} />
        </div>
        : <div className="suggestion-preview">
          <span><b>{suggestion.project}</b> / {suggestion.module}</span>
          <span>{suggestion.kind}</span>
          <span>{suggestion.priority}</span>
          <Confidence value={suggestion.confidence} />
        </div>)}
    </div>
    <button className="review-button" disabled={processed} onClick={onOpen}>
      {processed ? 'Plano executado' : errored ? 'Ver erro' : pending ? 'Ver andamento' : suggestion ? 'Revisar proposta' : 'Abrir revisão'}
      {processed ? <CheckCircle size={16} weight="fill" /> : <MagicWand size={16} />}
    </button>
  </article>
}

function ContextReviewPanel(props: ContextFlowProps & { item: InboxItem; onBack: () => void }) {
  if (props.item.harness) {
    return <HarnessReviewPanel inboxItem={props.item} projects={props.state.projects} notify={props.notify} onBack={props.onBack} />
  }
  if (!props.item.suggestion) return <LegacyPendingInboxPanel item={props.item} onBack={props.onBack} />
  return isAiPlanSuggestion(props.item.suggestion)
    ? <AiPlanReviewPanel {...props} plan={props.item.suggestion} />
    : <LegacyContextReviewPanel {...props} />
}

function LegacyPendingInboxPanel({ item, onBack }: { item: InboxItem; onBack: () => void }) {
  const failed = item.status === 'Com erro'
  return <div className="context-page harness-page">
    <button className="back-context" onClick={onBack}><ArrowLeft size={17} /> Voltar para fila</button>
    <section className={`harness-status-page ${failed ? 'error' : 'processing'}`}>
      {failed ? <WarningCircle size={35} /> : <SpinnerGap className="harness-spinner" size={35} />}
      <h1>{failed ? 'Falha ao processar entrada' : 'Processando entrada'}</h1>
      <p>{failed ? 'A IA não concluiu esta entrada. Volte à fila e envie novamente se necessário.' : 'Classificação em andamento. Esta tela será atualizada automaticamente na fila.'}</p>
    </section>
  </div>
}

function LegacyContextReviewPanel({ state, actions, notify, item, onBack }: ContextFlowProps & { item: InboxItem; onBack: () => void }) {
  const suggestion = item.suggestion as ContextSuggestion
  const [draft, setDraft] = useState<ContextSuggestion>(suggestion)
  const [tagsInput, setTagsInput] = useState('')
  const projects = useMemo(() => state.projects.map((project) => project.name), [state.projects])

  function patch<K extends keyof ContextSuggestion>(field: K, value: ContextSuggestion[K]) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function confirm() {
    const newTags = tagsInput.split(',').map((tag) => tag.trim()).filter(Boolean)
    void actions.confirmInbox(item.id, { ...draft, newTags })
    onBack()
  }

  function discard() {
    void actions.discardInbox(item.id)
    notify('Entrada descartada.', 'info')
    onBack()
  }

  return <div className="context-page">
    <button className="back-context" onClick={onBack}><ArrowLeft size={17} /> Voltar para fila</button>
    <PageHeading
      level="section"
      className="context-heading"
      eyebrow="REVISÃO CONTEXTUAL"
      title="Confirme antes de registrar"
      subtitle="A classificação é uma proposta. Ajuste qualquer campo que não represente a demanda."
      action={<Confidence value={draft.confidence} large />}
    />

    <div className="review-layout">
      <section className="review-column original-entry">
        <ColumnTitle icon={<FileText size={19} />} title="Entrada original" />
        <p>{item.text}</p>
        <div className="origin-meta"><span>{item.source}</span><span>{item.date}</span></div>
        <div className="summary-block">
          <small>RESUMO DA IA</small>
          <p>{draft.summary}</p>
        </div>
      </section>

      <section className="review-column classification-form">
        <ColumnTitle icon={<MagicWand size={19} />} title="Classificação proposta" />
        <label>Título do card<input value={draft.title} onChange={(event) => patch('title', event.target.value)} /></label>
        <div className="form-pair">
          <label>Projeto<select value={draft.project} onChange={(event) => patch('project', event.target.value)}>
            {projects.map((project) => <option key={project}>{project}</option>)}
          </select></label>
          <label>Módulo<input value={draft.module} onChange={(event) => patch('module', event.target.value)} /></label>
        </div>
        <div className="form-pair">
          <label>Tipo<select value={draft.kind} onChange={(event) => patch('kind', event.target.value as EntryKind)}>
            {kinds.map((kind) => <option key={kind}>{kind}</option>)}
          </select></label>
          <label>Prioridade<select value={draft.priority} onChange={(event) => patch('priority', event.target.value as Priority)}>
            {priorities.map((priority) => <option key={priority}>{priority}</option>)}
          </select></label>
        </div>
        <label>Complexidade<select value={draft.complexity} onChange={(event) => patch('complexity', event.target.value as Complexity)}>
          {complexities.map((complexity) => <option key={complexity}>{complexity}</option>)}
        </select></label>
        <label>Próxima ação<textarea value={draft.action} onChange={(event) => patch('action', event.target.value)} /></label>
        <label>Novas tags (separadas por vírgula)<input
          value={tagsInput}
          onChange={(event) => setTagsInput(event.target.value)}
          placeholder="Ex.: raster, urgente"
        /></label>
      </section>

      <aside className="review-column evidence-column">
        <ColumnTitle icon={<Lightbulb size={19} />} title="Por que essa classificação?" />
        <div className="evidence-list">{draft.evidence.map((evidence) => <div key={evidence}><CheckCircle size={16} weight="fill" /><span>{evidence}</span></div>)}</div>
        <div className="duplicate-block">
          <small>POSSÍVEL DUPLICIDADE</small>
          {draft.duplicates.length
            ? draft.duplicates.map((duplicate) => <button key={duplicate}><WarningCircle size={16} /><span>{duplicate}</span></button>)
            : <p>Nenhuma demanda semelhante encontrada.</p>}
        </div>
      </aside>
    </div>

    <footer className="review-footer">
      <button className="discard-button" onClick={discard}><Trash size={17} /> Descartar entrada</button>
      <span>Será criado 1 card em <b>Backlog</b>.</span>
      <Button variant="primary" className="confirm-context" icon={<CheckCircle size={18} weight="fill" />} onClick={confirm}>Confirmar e criar tarefa</Button>
    </footer>
  </div>
}

function AiPlanReviewPanel({ actions, notify, item, onBack, plan }: ContextFlowProps & { item: InboxItem; onBack: () => void; plan: AiPlan }) {
  const [draft, setDraft] = useState(plan)
  const [selected, setSelected] = useState(() => new Set(plan.actions.map((action) => action.id)))

  function toggle(actionId: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(actionId)) {
        next.delete(actionId)
        let changed = true
        while (changed) {
          changed = false
          draft.actions.forEach((action) => {
            if (next.has(action.id) && action.dependsOn.some((dependency) => !next.has(dependency))) {
              next.delete(action.id)
              changed = true
            }
          })
        }
      } else {
        const include = (id: string) => {
          if (next.has(id)) return
          draft.actions.find((action) => action.id === id)?.dependsOn.forEach(include)
          next.add(id)
        }
        include(actionId)
      }
      return next
    })
  }

  function patchTask(actionId: string, patch: Partial<TaskPlanAction['data']>) {
    setDraft((current) => ({
      ...current,
      actions: current.actions.map((action) => action.id === actionId && action.entity === 'task'
        ? { ...action, data: { ...action.data, ...patch } }
        : action),
    }))
  }

  function patchContext(actionId: string, patch: Partial<ContextPlanAction['data']>) {
    setDraft((current) => ({
      ...current,
      actions: current.actions.map((action) => action.id === actionId && action.entity === 'context'
        ? { ...action, data: { ...action.data, ...patch } }
        : action),
    }))
  }

  function confirm() {
    const approved = draft.actions.filter((action) => selected.has(action.id))
    if (!approved.length) {
      notify('Selecione pelo menos uma ação.', 'error')
      return
    }
    void actions.confirmInbox(item.id, { ...draft, actions: approved })
  }

  function discard() {
    void actions.discardInbox(item.id)
    notify('Entrada descartada.', 'info')
    onBack()
  }

  return <div className="context-page">
    <button className="back-context" onClick={onBack}><ArrowLeft size={17} /> Voltar para fila</button>
    <PageHeading
      level="section"
      className="context-heading"
      eyebrow="REVISÃO IA"
      title="Revise o plano completo"
      subtitle="Cada fato é independente. Desmarcar uma ação também desmarca o que depende dela."
      action={<Confidence value={draft.confidence} large />}
    />

    <div className="review-layout">
      <section className="review-column original-entry">
        <ColumnTitle icon={<FileText size={19} />} title="Entrada original" />
        <p>{item.text}</p>
        <div className="summary-block"><small>RESUMO DA IA</small><p>{draft.summary}</p></div>
        <div className="evidence-list">{draft.evidence.map((evidence) => <div key={evidence}><CheckCircle size={16} weight="fill" /><span>{evidence}</span></div>)}</div>
      </section>

      <section className="review-column classification-form">
        <ColumnTitle icon={<MagicWand size={19} />} title="Ações propostas" />
        {draft.actions.map((action) => <article className="view-panel" key={action.id}>
          <label>
            <input type="checkbox" checked={selected.has(action.id)} onChange={() => toggle(action.id)} />
            {entityLabel(action.entity)} · confiança {action.confidence}%
          </label>
          {action.entity === 'task' && <>
            <label>Título da tarefa<input value={action.data.title} onChange={(event) => patchTask(action.id, { title: event.target.value })} /></label>
            <label>Informações úteis<textarea value={action.data.description ?? ''} onChange={(event) => patchTask(action.id, { description: event.target.value })} /></label>
            <div className="form-pair">
              <label>Prazo citado<input type="date" value={dateInputValue(action.data.dueAt)} onChange={(event) => patchTask(action.id, { dueAt: event.target.value ? `${event.target.value}T00:00:00.000Z` : null })} /></label>
              <label>Complexidade percebida<select value={action.data.complexity ?? ''} onChange={(event) => patchTask(action.id, { complexity: event.target.value ? Number(event.target.value) : null })}>
                <option value="">Não informada</option><option value="1">Baixa</option><option value="2">Média</option><option value="3">Alta</option>
              </select></label>
            </div>
            <div className="form-pair">
              <label>Prioridade<select value={action.data.priority ?? ''} onChange={(event) => patchTask(action.id, { priority: (event.target.value || undefined) as TaskPlanAction['data']['priority'] })}>
                <option value="">Não informada</option>{priorities.map((priority) => <option key={priority}>{priority}</option>)}
              </select></label>
              <label>Módulo<input value={action.data.moduleName ?? ''} onChange={(event) => patchTask(action.id, { moduleName: event.target.value })} /></label>
            </div>
          </>}
          {action.entity === 'context' && <>
            <div className="form-pair">
              <label>Tipo de contexto<select value={action.data.category} onChange={(event) => patchContext(action.id, { category: event.target.value as ContextPlanAction['data']['category'] })}>
                <option value="FACT">Fato</option><option value="DECISION">Decisão</option><option value="RULE">Regra</option><option value="VOCABULARY">Vocabulário</option><option value="MEETING">Reunião</option>
              </select></label>
              <label>Título do contexto<input value={action.data.title} onChange={(event) => patchContext(action.id, { title: event.target.value })} /></label>
            </div>
            <label>Informação para contexto<textarea value={action.data.content} onChange={(event) => patchContext(action.id, { content: event.target.value })} /></label>
          </>}
          {action.entity !== 'task' && action.entity !== 'context' && <p>{actionDescription(action)}</p>}
          <ActionEvidence action={action} />
        </article>)}
      </section>
    </div>

    <footer className="review-footer">
      <button className="discard-button" onClick={discard}><Trash size={17} /> Descartar entrada</button>
      <span>{selected.size} de {draft.actions.length} ações serão executadas.</span>
      <Button variant="primary" className="confirm-context" icon={<CheckCircle size={18} weight="fill" />} onClick={confirm}>Aprovar plano</Button>
    </footer>
  </div>
}

type TaskPlanAction = Extract<AiPlanAction, { entity: 'task' }>
type ContextPlanAction = Extract<AiPlanAction, { entity: 'context' }>

function ActionEvidence({ action }: { action: AiPlanAction }) {
  return <div className="extracted-evidence"><small>EVIDÊNCIA</small>{action.evidence.map((evidence) => <span key={evidence}>{evidence}</span>)}</div>
}

function dateInputValue(value: string | null | undefined) {
  return value?.slice(0, 10) ?? ''
}

function isAiPlanSuggestion(suggestion: InboxItem['suggestion']): suggestion is AiPlan {
  return Boolean(suggestion && 'actions' in suggestion && Array.isArray(suggestion.actions))
}

function entityLabel(entity: AiPlanAction['entity']) {
  return ({ project: 'Projeto', context: 'Contexto', task: 'Tarefa', milestone: 'Marco', dependency: 'Dependência', alias: 'Alias', module: 'Módulo', tag: 'Tag' })[entity]
}

function actionDescription(action: AiPlanAction) {
  if (action.entity === 'project') return action.data.name
  if (action.entity === 'task') return action.data.title
  if (action.entity === 'milestone') return action.data.name
  if (action.entity === 'alias') return action.data.value
  if (action.entity === 'module' || action.entity === 'tag') return action.data.name
  return 'Vincular dependência entre tarefas.'
}

function ColumnTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return <div className="column-title">{icon}<h2>{title}</h2></div>
}

function StatusBadge({ status }: { status: InboxItem['status'] }) {
  return <span className={`context-status ${status.toLocaleLowerCase().replaceAll(' ', '-').normalize('NFD').replace(/[̀-ͯ]/g, '')}`}>{status}</span>
}

function confidenceTone(value: number): BadgeTone {
  if (value >= 85) return 'success'
  if (value >= 60) return 'warning'
  return 'danger'
}

function Confidence({ value, large = false }: { value: number; large?: boolean }) {
  return <div className={`confidence ${large ? 'large' : ''} tone-${confidenceTone(value)}`}>
    <span>Confiança</span>
    <strong>{value}%</strong>
    {large && <div><i style={{ width: `${value}%` }} /></div>}
  </div>
}
