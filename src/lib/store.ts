'use client'

import { useCallback, useRef, useState } from 'react'
import {
  addContext,
  addInboxItem,
  addNote,
  addProject,
  addProjectAlias,
  addProjectModule,
  addTask,
  completeTask as completeTaskInState,
  confirmInboxItem,
  convertNoteToTask,
  discardInboxItem as discardInboxItemInState,
  moveTaskTo,
  pendingInboxStatuses,
  removeContext as removeContextInState,
  removeProjectAlias,
  removeProjectModule,
  reorderNotes,
  setProjectTags,
  setTaskMilestones as setTaskMilestonesInState,
  setTaskTags as setTaskTagsInState,
  toggleNotePinned,
  toggleProjectArchived,
  updateContext as updateContextInState,
  updateInboxSuggestion,
  updateNote as updateNoteInState,
  updateProject as updateProjectInState,
  updateTask as updateTaskInState,
  withDerivedProgress,
  type AppState,
  type ContextSuggestion,
  type Note,
  type Priority,
  type ProjectContextEntry,
  type Task,
  type TaskStatus,
} from '../domain'
import { ApiError, deleteJson, getJson, patchJson, postForm, postJson } from './api'
import type { Notify } from '../ui'
import {
  toContextCreateBody,
  toContextPatchBody,
  toDbComplexity,
  toDbDue,
  toDbKind,
  toDbModule,
  toDomainContext,
  toDomainInbox,
  toDomainNote,
  toDomainProject,
  toDomainTask,
  toNoteCreateBody,
  toNotePatchBody,
  toProjectPatchBody,
  toTaskCreateBody,
  toTaskPatchBody,
  type DbContext,
  type DbInboxItem,
  type DbNote,
  type DbProject,
  type DbTask,
  type TaskPatch,
} from './mapping'

export type ProjectFormInput = {
  name: string
  description: string
  priority: Priority
  aliases: string[]
  modules: string[]
  tags: string[]
}

export type TaskHistoryEntry = { id: string; action: string; createdAt: string; metadata: unknown }

type Mutation<Result> = {
  /** Função pura de `domain.ts`. Devolver o mesmo estado significa entrada inválida. */
  apply: (state: AppState) => AppState
  persist: (context: { before: AppState; after: AppState }) => Promise<Result>
  reconcile?: (state: AppState, result: Result, context: { before: AppState; after: AppState }) => AppState
  invalid?: string
  success?: string
}

/**
 * Única peça que sabe que existe rede. Aplica a mutação na hora, persiste, e em
 * falha volta ao estado anterior com o motivo no toast. Só a caixa de entrada e a
 * ordem do plano do dia continuam em memória e usam `setState` direto; criar e
 * editar marco também, porque é Fase 5.
 */
export function useProjectData(initial: AppState, notify: Notify) {
  const [state, setStateValue] = useState(initial)
  const stateRef = useRef(state)
  const notifyRef = useRef(notify)
  notifyRef.current = notify

  const commit = useCallback((next: AppState) => {
    const derived = withDerivedProgress(next)
    stateRef.current = derived
    setStateValue(derived)
  }, [])

  const setState = useCallback((next: AppState) => commit(next), [commit])

  const mutate = useCallback(async <Result,>(mutation: Mutation<Result>) => {
    const before = stateRef.current
    const after = mutation.apply(before)
    if (after === before) {
      notifyRef.current(mutation.invalid ?? 'Operação inválida', 'error')
      return
    }
    commit(after)

    try {
      const result = await mutation.persist({ before, after })
      if (mutation.reconcile) commit(mutation.reconcile(stateRef.current, result, { before, after }))
      if (mutation.success) notifyRef.current(mutation.success)
    } catch (error) {
      // Volta ao estado anterior inteiro: sem isso a tela mostraria algo que o banco não tem.
      commit(before)
      notifyRef.current(error instanceof ApiError ? error.detail : 'Falha ao salvar', 'error')
    }
  }, [commit])

  /**
   * Vários fluxos criam card: a criação rápida, a aprovação da caixa de entrada e
   * a conversão de nota. Todos gravam pelo mesmo par persistir/reconciliar.
   */
  const persistCreatedTask = ({ before, after }: { before: AppState; after: AppState }) => {
    const created = added(before.tasks, after.tasks)
    if (!created) return Promise.resolve(null)
    const project = after.projects.find((item) => item.name === created.project)
    if (!project) throw new ApiError(0, 'Projeto não encontrado.')
    return postJson<{ task: DbTask }>('/api/tasks', toTaskCreateBody(project.id, created))
  }

  // O id otimista (`task-<timestamp>`) some assim que o banco devolve o cuid.
  const reconcileCreatedTask = (
    current: AppState,
    result: { task: DbTask } | null,
    { before, after }: { before: AppState; after: AppState },
  ) => {
    const created = added(before.tasks, after.tasks)
    return result && created ? replaceTask(current, created.id, toDomainTask(result.task)) : current
  }

  const actions = {
    createProject(input: { name: string; description: string; color: string; priority: Priority }) {
      return mutate({
        apply: (current) => addProject(current, input),
        invalid: 'Informe um nome único para o projeto',
        success: 'Projeto criado',
        persist: () => postJson<{ project: DbProject }>('/api/projects', input),
        reconcile: (current, { project }, { before, after }) => {
          const created = added(before.projects, after.projects)
          return created ? replaceProject(current, created.id, toDomainProject(project)) : current
        },
      })
    },

    saveProject(projectId: string, input: ProjectFormInput) {
      return mutate({
        apply: (current) => applyProjectForm(current, projectId, input),
        invalid: 'Nome inválido ou já usado por outro projeto',
        success: 'Projeto atualizado',
        persist: () => patchJson<{ project: DbProject }>(`/api/projects/${projectId}`, toProjectPatchBody({
          name: input.name,
          description: input.description,
          priority: input.priority,
          aliases: input.aliases,
          modules: input.modules,
          tags: input.tags.map((name) => ({ name })),
        })),
        // A resposta traz o id real das etiquetas novas; sem trocar, o vínculo com
        // o card ficaria preso no id temporário criado por `setProjectTags`.
        reconcile: (current, { project }) => replaceProject(current, projectId, toDomainProject(project)),
      })
    },

    toggleArchived(projectId: string) {
      const project = stateRef.current.projects.find((item) => item.id === projectId)
      const archived = !project?.archived
      return mutate({
        apply: (current) => toggleProjectArchived(current, projectId),
        success: archived ? 'Projeto arquivado' : 'Projeto reativado',
        persist: () => patchJson(`/api/projects/${projectId}`, { archived }),
      })
    },

    createTask(input: Parameters<typeof addTask>[1]) {
      return mutate({
        apply: (current) => addTask(current, input),
        invalid: 'Informe título e projeto válidos',
        success: 'Tarefa criada',
        persist: persistCreatedTask,
        reconcile: reconcileCreatedTask,
      })
    },

    captureInbox(text: string) {
      return mutate({
        apply: (current) => addInboxItem(current, text),
        invalid: 'Escreva o que aconteceu antes de enviar',
        persist: ({ before, after }) => {
          const created = added(before.inbox, after.inbox)
          return created
            ? postJson<{ inboxItem: DbInboxItem }>('/api/inbox', { text: created.text })
            : Promise.resolve(null)
        },
        reconcile: (current, result, { before, after }) => {
          const created = added(before.inbox, after.inbox)
          return result && created ? replaceInbox(current, created.id, toDomainInbox(result.inboxItem)) : current
        },
      })
    },

    /** Sem otimista: nada para mostrar antes do upload terminar. */
    async captureInboxAudio(file: File | Blob, caption?: string) {
      const form = new FormData()
      form.append('file', file, file instanceof File ? file.name : 'gravacao.webm')
      if (caption?.trim()) form.append('text', caption.trim())
      try {
        const { inboxItem } = await postForm<{ inboxItem: DbInboxItem }>('/api/inbox/audio', form)
        commit({ ...stateRef.current, inbox: [toDomainInbox(inboxItem), ...stateRef.current.inbox] })
        notifyRef.current('Áudio enviado — acompanhe o status na lista.')
      } catch (error) {
        notifyRef.current(error instanceof ApiError ? error.detail : 'Falha ao enviar áudio', 'error')
      }
    },

    /** Aplica a correção do usuário e confirma numa tacada só: se o servidor recusar, os dois voltam juntos. */
    confirmInbox(inboxId: string, draft: ContextSuggestion & { tags?: string[] }) {
      return mutate({
        apply: (current) => confirmInboxItem(updateInboxSuggestion(current, inboxId, draft), inboxId),
        success: 'Tarefa criada no Backlog com contexto registrado.',
        persist: ({ before, after }) => {
          const project = after.projects.find((item) => item.name === draft.project)
          if (!project) throw new ApiError(0, 'Projeto não encontrado.')
          return postJson<{ inboxItem: DbInboxItem; task: DbTask | null }>(`/api/inbox/${inboxId}/confirm`, {
            projectId: project.id,
            title: draft.title,
            moduleName: toDbModule(draft.module),
            kind: toDbKind(draft.kind),
            priority: draft.priority,
            complexity: toDbComplexity(draft.complexity),
            dueAt: toDbDue(draft.due),
            forecastAt: toDbDue(draft.forecast),
            tags: draft.newTags ?? [],
          })
        },
        reconcile: (current, result, { before, after }) => {
          const withInbox = replaceInbox(current, inboxId, toDomainInbox(result.inboxItem as DbInboxItem))
          const createdTask = added(before.tasks, after.tasks)
          return result.task && createdTask
            ? replaceTask(withInbox, createdTask.id, toDomainTask(result.task))
            : withInbox
        },
      })
    },

    discardInbox(inboxId: string) {
      return mutate({
        apply: (current) => discardInboxItemInState(current, inboxId),
        success: 'Entrada descartada',
        persist: () => patchJson(`/api/inbox/${inboxId}`, { status: 'Descartada' }),
      })
    },

    /**
     * Só troca localmente o que ainda está em status pendente. Sem essa guarda, um
     * GET disparado antes de um confirmar/descartar mas respondido depois desfaria
     * a ação: a resposta atrasada reintroduziria a proposta como se nada tivesse
     * acontecido.
     */
    refreshInbox() {
      return getJson<{ inbox: DbInboxItem[] }>('/api/inbox').then(({ inbox }) => {
        const current = stateRef.current
        const incoming = new Map(inbox.map((item) => [item.id, toDomainInbox(item)]))
        const merged = current.inbox.map((item) => pendingInboxStatuses.includes(item.status)
          ? (incoming.get(item.id) ?? item)
          : item)
        const knownIds = new Set(current.inbox.map((item) => item.id))
        const additions = [...incoming.values()].filter((item) => !knownIds.has(item.id))
        commit({ ...current, inbox: [...additions, ...merged] })
      })
    },

    convertNote(noteId: string, projectName: string) {
      return mutate({
        apply: (current) => convertNoteToTask(current, noteId, projectName),
        invalid: 'Selecione um projeto válido',
        success: 'Nota convertida em card no Backlog',
        persist: persistCreatedTask,
        reconcile: reconcileCreatedTask,
      })
    },

    updateTask(taskId: string, patch: TaskPatch) {
      return mutate({
        apply: (current) => updateTaskInState(current, taskId, patch),
        invalid: 'Dados inválidos para a tarefa',
        success: 'Tarefa atualizada',
        persist: () => patchJson(`/api/tasks/${taskId}`, toTaskPatchBody(patch)),
      })
    },

    setTaskTags(taskId: string, tagIds: string[]) {
      return mutate({
        apply: (current) => setTaskTagsInState(current, taskId, tagIds),
        invalid: 'Não foi possível atualizar as etiquetas',
        // O domínio já descartou etiqueta de outro projeto; o servidor faz o mesmo.
        persist: (context) => patchJson(`/api/tasks/${taskId}`, toTaskPatchBody({
          tagIds: context.after.tasks.find((task) => task.id === taskId)?.tagIds ?? [],
        })),
      })
    },

    setTaskMilestones(taskId: string, milestoneIds: string[]) {
      return mutate({
        apply: (current) => setTaskMilestonesInState(current, taskId, milestoneIds),
        invalid: 'Não foi possível atualizar os marcos',
        persist: (context) => patchJson(`/api/tasks/${taskId}`, toTaskPatchBody({
          milestoneIds: context.after.tasks.find((task) => task.id === taskId)?.milestoneIds ?? [],
        })),
      })
    },

    moveTask(taskId: string, status: TaskStatus, beforeTaskId?: string) {
      return mutate({
        apply: (current) => moveTaskTo(current, taskId, status, beforeTaskId),
        success: `Card movido para ${status}`,
        persist: () => patchJson(`/api/tasks/${taskId}`, toTaskPatchBody({ status })),
      })
    },

    completeTask(taskId: string) {
      return mutate({
        apply: (current) => completeTaskInState(current, taskId),
        success: 'Tarefa concluída e plano atualizado',
        persist: () => patchJson(`/api/tasks/${taskId}`, toTaskPatchBody({ status: 'Concluída' })),
      })
    },

    createNote(input: { title: string; content: string; projectId: string; taskId?: string }) {
      return mutate({
        apply: (current) => addNote(current, input),
        invalid: 'Informe o conteúdo e o projeto da nota',
        success: 'Nota privada salva',
        persist: ({ before, after }) => {
          const created = added(before.notes, after.notes)
          return created
            ? postJson<{ note: DbNote }>('/api/notes', toNoteCreateBody(created))
            : Promise.resolve(null)
        },
        reconcile: (current, result, { before, after }) => {
          const created = added(before.notes, after.notes)
          return result && created ? replaceNote(current, created.id, toDomainNote(result.note)) : current
        },
      })
    },

    saveNote(noteId: string, input: { title: string; content: string; taskId: string | undefined }) {
      return mutate({
        apply: (current) => updateNoteInState(current, noteId, input),
        invalid: 'Conteúdo da nota é obrigatório',
        success: 'Nota atualizada',
        persist: ({ after }) => {
          const note = after.notes.find((item) => item.id === noteId)
          return patchJson(`/api/notes/${noteId}`, toNotePatchBody({
            title: note?.title,
            content: note?.content,
            // O domínio pode ter descartado card de outro projeto: manda o que ficou.
            taskId: note?.taskId ?? null,
          }))
        },
      })
    },

    toggleNotePin(noteId: string) {
      const pinned = !stateRef.current.notes.find((note) => note.id === noteId)?.pinned
      return mutate({
        apply: (current) => toggleNotePinned(current, noteId),
        invalid: 'Nota não encontrada',
        success: pinned ? 'Nota fixada' : 'Nota removida das fixadas',
        persist: () => patchJson(`/api/notes/${noteId}`, toNotePatchBody({ pinned })),
      })
    },

    /** Um arraste é uma gravação só: `reorderNotes` já calculou a posição nova. */
    moveNote(noteId: string, targetPinned: boolean, beforeNoteId?: string) {
      return mutate({
        apply: (current) => {
          const note = current.notes.find((item) => item.id === noteId)
          if (!note) return current
          const pinned = note.pinned === targetPinned ? current : toggleNotePinned(current, noteId)
          return reorderNotes(pinned, noteId, beforeNoteId)
        },
        invalid: 'Ordem das notas inalterada',
        persist: ({ after }) => {
          const note = after.notes.find((item) => item.id === noteId)
          return note
            ? patchJson(`/api/notes/${noteId}`, toNotePatchBody({ pinned: note.pinned, position: note.position }))
            : Promise.resolve(null)
        },
      })
    },

    createContext(input: { projectId: string; title: string; content: string; taskId?: string }) {
      return mutate({
        apply: (current) => addContext(current, input),
        invalid: 'Informe título, conteúdo e projeto do contexto',
        success: 'Contexto registrado e disponível para a IA',
        persist: ({ before, after }) => {
          const created = added(before.contexts, after.contexts)
          return created
            ? postJson<{ context: DbContext }>('/api/contexts', toContextCreateBody(created))
            : Promise.resolve(null)
        },
        reconcile: (current, result, { before, after }) => {
          const created = added(before.contexts, after.contexts)
          return result && created
            ? replaceContext(current, created.id, toDomainContext(result.context))
            : current
        },
      })
    },

    saveContext(contextId: string, input: { title: string; content: string; taskId: string | undefined }) {
      return mutate({
        apply: (current) => updateContextInState(current, contextId, input),
        invalid: 'Título e conteúdo são obrigatórios',
        success: 'Contexto atualizado',
        persist: ({ after }) => {
          const context = after.contexts.find((item) => item.id === contextId)
          return patchJson(`/api/contexts/${contextId}`, toContextPatchBody({
            title: context?.title,
            content: context?.content,
            taskId: context?.taskId ?? null,
          }))
        },
      })
    },

    removeContext(contextId: string) {
      return mutate({
        apply: (current) => removeContextInState(current, contextId),
        invalid: 'Contexto não encontrado',
        success: 'Contexto removido',
        persist: () => deleteJson(`/api/contexts/${contextId}`),
      })
    },

    /** Histórico vem da auditoria e não fica no estado: é lido ao abrir o card. */
    loadTaskHistory(taskId: string) {
      return getJson<{ history: TaskHistoryEntry[] }>(`/api/tasks/${taskId}`).then((payload) => payload.history)
    },
  }

  return { state, setState, actions }
}

export type ProjectActions = ReturnType<typeof useProjectData>['actions']

function applyProjectForm(state: AppState, projectId: string, input: ProjectFormInput): AppState {
  let next = updateProjectInState(state, projectId, {
    name: input.name,
    description: input.description,
    priority: input.priority,
  })
  if (next === state) return state
  const current = next.projects.find((project) => project.id === projectId)
  if (!current) return state
  current.aliases.forEach((alias) => { next = removeProjectAlias(next, projectId, alias) })
  input.aliases.forEach((alias) => { next = addProjectAlias(next, projectId, alias) })
  current.modules.forEach((module) => { next = removeProjectModule(next, projectId, module) })
  input.modules.forEach((module) => { next = addProjectModule(next, projectId, module) })
  return setProjectTags(next, projectId, input.tags.map((name) => ({ name })))
}

function added<Item extends { id: string }>(before: Item[], after: Item[]): Item | undefined {
  return after.find((item) => !before.some((previous) => previous.id === item.id))
}

/**
 * Troca o projeto otimista pelo do banco e, no caminho, refaz os vínculos de
 * etiqueta dos cards: a etiqueta criada agora tinha id temporário até a resposta.
 */
function replaceProject(state: AppState, temporaryId: string, project: AppState['projects'][number]): AppState {
  const previous = state.projects.find((item) => item.id === temporaryId)
  if (!previous) return state
  const byName = new Map(project.tags.map((tag) => [tag.name.toLocaleLowerCase(), tag.id]))
  const oldIdToNew = new Map(previous.tags
    .map((tag) => [tag.id, byName.get(tag.name.toLocaleLowerCase())] as const)
    .filter((entry): entry is readonly [string, string] => Boolean(entry[1]) && entry[0] !== entry[1]))

  const swapTags = (task: Task): Task => !oldIdToNew.size || !task.tagIds?.some((id) => oldIdToNew.has(id))
    ? task
    : { ...task, tagIds: task.tagIds.map((id) => oldIdToNew.get(id) ?? id) }

  return {
    ...state,
    projects: state.projects.map((item) => item.id === temporaryId ? { ...project, progress: item.progress } : item),
    tasks: state.tasks.map(swapTags),
    actionPlan: state.actionPlan.map(swapTags),
  }
}

function replaceTask(state: AppState, temporaryId: string, task: Task): AppState {
  const swap = (item: Task) => item.id === temporaryId ? task : item
  return {
    ...state,
    tasks: state.tasks.map(swap),
    actionPlan: state.actionPlan.map(swap),
    // A nota convertida aponta para o card: sem isso ela ficaria presa no id temporário.
    notes: state.notes.map((note) => note.convertedTaskId === temporaryId ? { ...note, convertedTaskId: task.id } : note),
  }
}

function replaceNote(state: AppState, temporaryId: string, note: Note): AppState {
  return {
    ...state,
    notes: state.notes.map((item) => item.id === temporaryId ? note : item),
  }
}

function replaceContext(state: AppState, temporaryId: string, context: ProjectContextEntry): AppState {
  return {
    ...state,
    contexts: state.contexts.map((item) => item.id === temporaryId ? context : item),
  }
}

function replaceInbox(state: AppState, temporaryId: string, inboxItem: AppState['inbox'][number]): AppState {
  return {
    ...state,
    inbox: state.inbox.map((item) => item.id === temporaryId ? inboxItem : item),
  }
}
