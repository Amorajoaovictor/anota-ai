'use client'

import { Flag, FolderOpen, MagnifyingGlass, NotePencil, Sticker, CheckSquare } from '@phosphor-icons/react'
import { useMemo, useState, type KeyboardEvent } from 'react'
import { searchAll, type AppState, type SearchHit } from '../domain'
import { Modal } from './modal'

export type CommandAction = { kind: 'action'; id: string; title: string; subtitle: string }
export type PaletteResult = SearchHit | CommandAction

const kindIcon: Record<PaletteResult['kind'], typeof MagnifyingGlass> = {
  action: MagnifyingGlass,
  project: FolderOpen,
  task: CheckSquare,
  milestone: Flag,
  note: NotePencil,
  context: Sticker,
}

const kindLabel: Record<PaletteResult['kind'], string> = {
  action: 'Ações',
  project: 'Projetos',
  task: 'Tarefas',
  milestone: 'Marcos',
  note: 'Notas',
  context: 'Contextos',
}

function groupOrder(kind: PaletteResult['kind']): number {
  return ['action', 'project', 'task', 'milestone', 'note', 'context'].indexOf(kind)
}

export function CommandPalette({ state, actions, onClose, onSelect }: {
  state: AppState
  actions: CommandAction[]
  onClose: () => void
  onSelect: (result: PaletteResult) => void
}) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const results = useMemo<PaletteResult[]>(() => {
    const normalized = query.trim().toLocaleLowerCase()
    const matchedActions = normalized
      ? actions.filter((action) => action.title.toLocaleLowerCase().includes(normalized))
      : actions
    return [...matchedActions, ...searchAll(state, query)]
  }, [query, state, actions])

  const grouped = useMemo(() => {
    const groups = new Map<PaletteResult['kind'], PaletteResult[]>()
    for (const result of results) {
      const list = groups.get(result.kind) ?? []
      list.push(result)
      groups.set(result.kind, list)
    }
    return [...groups.entries()].sort(([left], [right]) => groupOrder(left) - groupOrder(right))
  }, [results])

  function select(result: PaletteResult) {
    onSelect(result)
    onClose()
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, results.length - 1)) }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)) }
    if (event.key === 'Home') { event.preventDefault(); setActiveIndex(0) }
    if (event.key === 'End') { event.preventDefault(); setActiveIndex(results.length - 1) }
    if (event.key === 'Enter' && results[activeIndex]) { event.preventDefault(); select(results[activeIndex]) }
  }

  return <Modal title="Buscar" size="md" onClose={onClose}>
    <div className="palette" onKeyDown={onKeyDown}>
      <label className="palette-input">
        <MagnifyingGlass size={18} />
        <input
          autoFocus
          aria-label="Buscar tarefas, projetos, marcos, notas e contextos"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-listbox"
          aria-activedescendant={results[activeIndex] ? `palette-option-${results[activeIndex].kind}-${results[activeIndex].id}` : undefined}
          placeholder="Buscar tarefas, projetos, marcos, notas..."
          value={query}
          onChange={(event) => { setQuery(event.target.value); setActiveIndex(0) }}
        />
      </label>

      <div id="palette-listbox" role="listbox" aria-label="Resultados da busca">
        {grouped.map(([kind, items]) => <div key={kind}>
          <p className="palette-group">{kindLabel[kind]}</p>
          {items.map((result) => {
            const Icon = kindIcon[result.kind]
            const index = results.indexOf(result)
            const active = index === activeIndex
            return <button
              key={`${result.kind}-${result.id}`}
              id={`palette-option-${result.kind}-${result.id}`}
              role="option"
              aria-selected={active}
              type="button"
              className={`palette-option ${active ? 'active' : ''}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => select(result)}
            >
              <Icon size={16} />
              <span><b>{result.title}</b>{result.subtitle && <small>{result.subtitle}</small>}</span>
            </button>
          })}
        </div>)}

        {query.trim() && !results.length && <p className="palette-empty">Nenhum resultado para “{query.trim()}”.</p>}
      </div>

      <div className="palette-foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
        <span><kbd>↵</kbd> abrir</span>
        <span><kbd>Esc</kbd> fechar</span>
      </div>
    </div>
  </Modal>
}
