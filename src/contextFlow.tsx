import {
  ArrowLeft,
  CheckCircle,
  CloudSlash,
  FileAudio,
  FileText,
  Lightbulb,
  MagicWand,
  Microphone,
  PaperPlaneTilt,
  Sparkle,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react'
import { useMemo, useState, type ReactNode } from 'react'
import {
  addInboxItem,
  analyzeInboxItem,
  discardInboxItem,
  updateInboxSuggestion,
  type AppState,
  type ContextSuggestion,
  type EntryKind,
  type InboxItem,
  type Priority,
} from './domain'
import type { ProjectActions } from './lib/store'
import { Badge, Button, EmptyState, PageHeading, type Notify } from './ui'

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

export function SmartInboxView(props: ContextFlowProps) {
  const { state, setState, notify } = props
  const [text, setText] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = state.inbox.find((item) => item.id === selectedId)
  const active = state.inbox.filter((item) => item.status !== 'Descartada')

  if (selected?.suggestion) {
    return <ContextReviewPanel {...props} item={selected} onBack={() => setSelectedId(null)} />
  }

  function captureAndAnalyze() {
    const captured = addInboxItem(state, text)
    if (captured === state) return
    const item = captured.inbox[0]
    const analyzed = analyzeInboxItem(captured, item.id)
    setState(analyzed)
    setText('')
    setSelectedId(item.id)
  }

  function analyze(item: InboxItem) {
    const next = analyzeInboxItem(state, item.id)
    setState(next)
    setSelectedId(item.id)
    notify('Contexto analisado — vale só nesta sessão. Revise antes de confirmar.', 'info')
  }

  return <div className="context-page">
    <PageHeading
      level="section"
      className="context-heading"
      eyebrow="ENTRADAS E CONTEXTO"
      title="Caixa de entrada inteligente"
      subtitle="Registre do seu jeito. O agente encontra projeto, módulo e próxima ação."
      action={<Badge tone="warning" icon={<CloudSlash size={13} />} title="A caixa de entrada ainda não é gravada no banco. Ao recarregar, os itens somem. Persistência prevista para a Fase 4.">Não salvo</Badge>}
    />

    <section className="capture-hub view-panel">
      <div className="capture-copy">
        <Sparkle size={22} weight="duotone" />
        <div>
          <strong>O que aconteceu?</strong>
          <span>Descreva uma demanda, decisão, bloqueio ou ideia sem preencher formulário.</span>
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
          <button className="input-mode" type="button" onClick={() => notify('Gravação de áudio entra na próxima etapa do protótipo')}><Microphone size={17} /> Gravar áudio</button>
          <button className="input-mode" type="button" onClick={() => notify('Upload de áudio entra na próxima etapa do protótipo')}><FileAudio size={17} /> Enviar arquivo</button>
        </div>
        <Button variant="primary" className="capture-submit" disabled={!text.trim()} onClick={captureAndAnalyze} trailing={<PaperPlaneTilt size={17} weight="fill" />}>
          Analisar contexto
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
      {active.map((item) => <InboxCard
        key={item.id}
        item={item}
        onOpen={() => item.suggestion ? setSelectedId(item.id) : analyze(item)}
      />)}
    </section>
  </div>
}

export function ContextReviewQueue(props: ContextFlowProps) {
  const { state } = props
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const pending = state.inbox.filter((item) => item.status === 'Aguardando confirmação' && item.suggestion)
  const selected = pending.find((item) => item.id === selectedId)

  if (selected) {
    return <ContextReviewPanel {...props} item={selected} onBack={() => setSelectedId(null)} />
  }

  return <div className="context-page">
    <PageHeading
      level="section"
      className="context-heading"
      eyebrow="APROVAÇÃO HUMANA"
      title="Revisão contextual"
      subtitle="Confira evidências e corrija a proposta antes de criar ou atualizar qualquer card."
      action={<Badge tone="warning" icon={<CloudSlash size={13} />} title="A fila de revisão ainda não é gravada no banco. Ao recarregar, as propostas somem. Persistência prevista para a Fase 4.">Não salvo</Badge>}
    />
    <div className="review-overview view-panel">
      <div className="review-score"><MagicWand size={27} weight="duotone" /><div><strong>{pending.length} propostas</strong><span>aguardando decisão</span></div></div>
      <p>Nenhuma alteração acontece sem sua aprovação. Correções ajudam o agente a entender melhor cada projeto.</p>
    </div>
    <section className="context-list review-list">
      {pending.length
        ? pending.map((item) => <InboxCard key={item.id} item={item} onOpen={() => setSelectedId(item.id)} />)
        : <EmptyState icon={<CheckCircle size={34} weight="duotone" />} title="Revisão em dia" description="Novas classificações aparecerão aqui." />}
    </section>
  </div>
}

function InboxCard({ item, onOpen }: { item: InboxItem; onOpen: () => void }) {
  const suggestion = item.suggestion
  const processed = item.status === 'Processada'
  return <article className="context-card">
    <div className="context-source-icon"><FileText size={20} /></div>
    <div className="context-card-main">
      <div className="context-card-top">
        <StatusBadge status={item.status} />
        <span>{item.source} · {item.date}</span>
      </div>
      <p>{item.text}</p>
      {suggestion && <div className="suggestion-preview">
        <span><b>{suggestion.project}</b> / {suggestion.module}</span>
        <span>{suggestion.kind}</span>
        <span>{suggestion.priority}</span>
        <Confidence value={suggestion.confidence} />
      </div>}
    </div>
    <button className="review-button" disabled={processed} onClick={onOpen}>
      {processed ? 'Tarefa criada' : suggestion ? 'Revisar proposta' : 'Analisar contexto'}
      {processed ? <CheckCircle size={16} weight="fill" /> : <MagicWand size={16} />}
    </button>
  </article>
}

function ContextReviewPanel({ state, setState, actions, notify, item, onBack }: ContextFlowProps & { item: InboxItem; onBack: () => void }) {
  const suggestion = item.suggestion as ContextSuggestion
  const [draft, setDraft] = useState<ContextSuggestion>(suggestion)
  const projects = useMemo(() => state.projects.map((project) => project.name), [state.projects])

  function patch<K extends keyof ContextSuggestion>(field: K, value: ContextSuggestion[K]) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function confirm() {
    // A correção do usuário entra antes: é ela que vira o card gravado.
    setState(updateInboxSuggestion(state, item.id, draft))
    void actions.confirmInbox(item.id)
    onBack()
  }

  function discard() {
    setState(discardInboxItem(state, item.id))
    notify('Entrada descartada — vale só nesta sessão.', 'info')
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
        <label>Próxima ação<textarea value={draft.action} onChange={(event) => patch('action', event.target.value)} /></label>
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

function ColumnTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return <div className="column-title">{icon}<h2>{title}</h2></div>
}

function StatusBadge({ status }: { status: InboxItem['status'] }) {
  return <span className={`context-status ${status.toLocaleLowerCase().replaceAll(' ', '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`}>{status}</span>
}

function Confidence({ value, large = false }: { value: number; large?: boolean }) {
  return <div className={`confidence ${large ? 'large' : ''}`}>
    <span>Confiança</span>
    <strong>{value}%</strong>
    {large && <div><i style={{ width: `${value}%` }} /></div>}
  </div>
}
