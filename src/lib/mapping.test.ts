import { describe, expect, it } from 'vitest'
import {
  formatDateInput,
  formatDue,
  toAppState,
  toDbDate,
  toDbDue,
  toDomainInbox,
  toDomainMilestone,
  toDomainNote,
  toDomainTask,
  toProjectPatchBody,
  toTaskCreateBody,
  toTaskPatchBody,
  type DbContext,
  type DbInboxItem,
  type DbMilestone,
  type DbNote,
  type DbProject,
  type DbTask,
} from './mapping'

const dbProject = (overrides: Partial<DbProject> = {}): DbProject => ({
  id: 'project-1',
  name: 'VistaFor',
  description: 'Plataforma de loteamentos',
  color: '#68d7a7',
  priority: 'P0',
  status: 'ACTIVE',
  aliases: [{ value: 'PAX' }],
  modules: [{ name: 'Mapa' }],
  tags: [{ id: 'tag-1', name: 'raster', color: '#f0ad5b' }],
  ...overrides,
})

const dbTask = (overrides: Partial<DbTask> = {}): DbTask => ({
  id: 'task-1',
  title: 'Corrigir raster',
  description: '',
  status: 'IN_PROGRESS',
  kind: 'BUG',
  priority: 'P1',
  complexity: 2,
  dueAt: '2026-07-24T00:00:00.000Z',
  forecastAt: null,
  sourceInboxId: null,
  sourceNoteId: null,
  project: { name: 'VistaFor', color: '#68d7a7' },
  module: { name: 'Mapa' },
  dependsOn: [{ dependsOnId: 'task-2' }],
  ...overrides,
})

const dbMilestone = (overrides: Partial<DbMilestone> = {}): DbMilestone => ({
  id: 'milestone-1',
  name: 'Homologação CEGEO',
  description: 'Mapa aprovado.',
  status: 'IN_PROGRESS',
  startAt: '2026-07-20T00:00:00.000Z',
  targetAt: '2026-07-27T00:00:00.000Z',
  project: { name: 'VistaFor', color: '#68d7a7' },
  ...overrides,
})

const dbNote = (overrides: Partial<DbNote> = {}): DbNote => ({
  id: 'note-1',
  projectId: 'project-1',
  taskId: null,
  title: 'Conferir com a CEGEO',
  content: 'Validar antes de publicar.',
  pinned: false,
  position: 0,
  createdAt: '2026-07-26T12:30:00.000Z',
  convertedTask: null,
  ...overrides,
})

const dbContext = (overrides: Partial<DbContext> = {}): DbContext => ({
  id: 'context-1',
  projectId: 'project-1',
  taskId: 'task-1',
  title: 'Medidas passam pela CEGEO',
  content: 'Regra combinada com a equipe.',
  createdAt: '2026-07-25T09:00:00.000Z',
  ...overrides,
})

const dbInboxItem = (overrides: Partial<DbInboxItem> = {}): DbInboxItem => ({
  id: 'inbox-1',
  source: 'TEXT',
  status: 'AWAITING_CONFIRMATION',
  text: 'Planta principal travando o mapa',
  suggestion: { project: 'VistaFor', confidence: 90 },
  createdAt: '2026-07-29T08:00:00.000Z',
  ...overrides,
})

describe('tradução entre banco e domínio', () => {
  it('converte enums, complexidade e dependências do card', () => {
    expect(toDomainTask(dbTask())).toMatchObject({
      status: 'Em andamento',
      kind: 'Bug',
      complexity: 'Média',
      module: 'Mapa',
      due: '24/07',
      dependsOnIds: ['task-2'],
      color: '#68d7a7',
    })
  })

  it('mostra card sem módulo como Geral e sem complexidade como indefinido', () => {
    const task = toDomainTask(dbTask({ module: null, complexity: null, dueAt: null }))

    expect(task.module).toBe('Geral')
    expect(task.complexity).toBeUndefined()
    expect(task.due).toBeUndefined()
  })

  it('não devolve Geral como nome de módulo para o banco', () => {
    expect(toTaskCreateBody('project-1', toDomainTask(dbTask({ module: null }))).moduleName).toBe('')
    expect(toTaskPatchBody({ module: 'Geral' }).moduleName).toBe('')
    expect(toTaskPatchBody({ module: ' Mapa ' }).moduleName).toBe('Mapa')
  })

  it('manda só as chaves presentes no patch, porque o schema é estrito', () => {
    expect(toTaskPatchBody({ status: 'Concluída' })).toEqual({ status: 'COMPLETED' })
    expect(toTaskPatchBody({ complexity: undefined })).toEqual({})
  })

  it('faz ida e volta de DD/MM usando o ano corrente', () => {
    const iso = toDbDue('24/07', new Date(2026, 0, 1))

    expect(iso).toBe('2026-07-24T00:00:00.000Z')
    expect(formatDue(iso)).toBe('24/07')
    expect(toDbDue('')).toBeNull()
    expect(toDbDue('99/99')).toBeNull()
  })

  it('projeto arquivado chega marcado e progresso sai dos cards', () => {
    const state = toAppState(
      [dbProject(), dbProject({ id: 'project-2', name: 'Intranet', status: 'ARCHIVED', aliases: [], modules: [], tags: [] })],
      [dbTask(), dbTask({ id: 'task-2', status: 'COMPLETED' })],
    )

    expect(state.projects[0]).toMatchObject({ aliases: ['PAX'], modules: ['Mapa'], archived: false, progress: 50 })
    // Projeto sem card fica em 0% em vez de dividir por zero.
    expect(state.projects[1]).toMatchObject({ archived: true, progress: 0 })
    // Concluídos e cancelados não entram no plano do dia.
    expect(state.actionPlan.map((task) => task.id)).toEqual(['task-1'])
  })

  it('traz etiquetas do projeto e os vínculos do card', () => {
    const state = toAppState([dbProject()], [dbTask({ tags: [{ tagId: 'tag-1' }] })])

    expect(state.projects[0]!.tags).toEqual([{ id: 'tag-1', name: 'raster', color: '#f0ad5b' }])
    expect(state.tasks[0]!.tagIds).toEqual(['tag-1'])
  })

  it('descrição vazia e previsão nula não viram string vazia na tela', () => {
    const task = toDomainTask(dbTask())

    expect(task.description).toBeUndefined()
    expect(task.forecast).toBeUndefined()
    expect(toDomainTask(dbTask({ forecastAt: '2026-08-04T00:00:00.000Z' })).forecast).toBe('04/08')
  })

  it('previsão e prazo viajam em campos separados', () => {
    expect(toTaskPatchBody({ due: '24/07', forecast: '' }).forecastAt).toBeNull()
    expect(toTaskPatchBody({ forecast: '04/08' }).dueAt).toBeUndefined()
  })

  it('marco usa data completa, não o DD/MM do prazo', () => {
    expect(toDomainMilestone(dbMilestone())).toMatchObject({
      startDate: '2026-07-20',
      targetDate: '2026-07-27',
      status: 'Em andamento',
      project: 'VistaFor',
      color: '#68d7a7',
    })
    expect(formatDateInput(toDbDate('2026-07-27'))).toBe('2026-07-27')
    expect(toDbDate('')).toBeNull()
    expect(toDbDate('não é data')).toBeNull()
  })

  it('marco sem data de início chega sem data em vez de string vazia', () => {
    expect(toDomainMilestone(dbMilestone({ startAt: null })).startDate).toBeUndefined()
  })

  it('nota carrega o card convertido e o vínculo opcional', () => {
    expect(toDomainNote(dbNote({ taskId: 'task-1', convertedTask: { id: 'task-9' } }))).toMatchObject({
      taskId: 'task-1',
      convertedTaskId: 'task-9',
      visibility: 'Privada',
      availableToAi: false,
      availableToMcp: false,
    })
    expect(toDomainNote(dbNote()).taskId).toBeUndefined()
  })

  it('notas chegam na ordem das posições, que é o que o arraste assume', () => {
    const state = toAppState([dbProject()], [], [], [
      dbNote({ id: 'note-b', position: 2 }),
      dbNote({ id: 'note-a', position: -1 }),
    ])

    expect(state.notes.map((note) => note.id)).toEqual(['note-a', 'note-b'])
  })

  it('carrega marcos, notas, contextos e caixa de entrada', () => {
    const state = toAppState([dbProject()], [dbTask()], [dbMilestone()], [dbNote()], [dbContext()], [dbInboxItem()])

    expect(state.milestones).toHaveLength(1)
    expect(state.notes).toHaveLength(1)
    expect(state.contexts[0]).toMatchObject({ projectId: 'project-1', taskId: 'task-1' })
    expect(state.inbox).toHaveLength(1)
    expect(state.inbox[0]).toMatchObject({ id: 'inbox-1', status: 'Aguardando confirmação' })
  })

  it('sem entradas na caixa, o estado segue vazio', () => {
    const state = toAppState([dbProject()], [dbTask()])
    expect(state.inbox).toEqual([])
  })

  it('traduz status, origem e devolve a sugestão como veio do servidor', () => {
    const item = toDomainInbox(dbInboxItem())
    expect(item).toMatchObject({
      id: 'inbox-1',
      text: 'Planta principal travando o mapa',
      source: 'Texto',
      status: 'Aguardando confirmação',
      suggestion: { project: 'VistaFor', confidence: 90 },
    })
    expect(item.date).not.toBe('')
  })

  it('entrada sem sugestão ainda mapeia para undefined', () => {
    expect(toDomainInbox(dbInboxItem({ suggestion: null, status: 'RECEIVED' })).suggestion).toBeUndefined()
  })

  it('origem de áudio traduz para o rótulo em português', () => {
    expect(toDomainInbox(dbInboxItem({ source: 'AUDIO' })).source).toBe('Áudio')
  })

  it('etiqueta viaja por nome, e a cor só quando existe', () => {
    expect(toProjectPatchBody({ tags: [{ name: 'raster' }, { name: 'CEGEO', color: '#f0ad5b' }] }).tags).toEqual([
      { name: 'raster' },
      { name: 'CEGEO', color: '#f0ad5b' },
    ])
    expect(toProjectPatchBody({ name: 'VistaFor' }).tags).toBeUndefined()
  })
})
