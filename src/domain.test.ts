import { describe, expect, it } from 'vitest'
import {
  addMilestone,
  addProject,
  addTask,
  addInboxItem,
  addNote,
  analyzeInboxItem,
  completeTask,
  confirmInboxItem,
  convertNoteToTask,
  filterTasksByMilestone,
  filterNotes,
  filterTasks,
  getMilestoneProgress,
  groupTasksByStatus,
  initialState,
  moveTask,
  removeMilestone,
  setTaskMilestones,
  toggleNotePinned,
  updateMilestone,
  updateNote,
  updateInboxSuggestion,
  updateProject,
  toggleProjectArchived,
  addProjectAlias,
  removeProjectAlias,
  addProjectModule,
  removeProjectModule,
  updateTask,
  type AppState,
} from './domain'

describe('Central de Projetos — fluxos críticos', () => {
  it('edita projeto, renomeia vínculos e rejeita nome duplicado ou vazio', () => {
    const updated = updateProject(initialState, 'vistafor', {
      name: '  VistaFor 2  ',
      description: '  Contexto revisado.  ',
      priority: 'P1',
    })
    const rejected = updateProject(updated, 'vistafor', { name: 'Intranet' })
    const empty = updateProject(updated, 'vistafor', { name: '   ' })

    expect(updated.projects.find((project) => project.id === 'vistafor')).toMatchObject({
      name: 'VistaFor 2',
      description: 'Contexto revisado.',
      priority: 'P1',
    })
    expect(updated.tasks.find((task) => task.id === 'task-1')?.project).toBe('VistaFor 2')
    expect(updated.milestones.find((milestone) => milestone.id === 'milestone-vistafor-mvp')?.project).toBe('VistaFor 2')
    expect(rejected).toBe(updated)
    expect(empty).toBe(updated)
  })

  it('arquiva projeto e impede retorno ao Kanban ativo', () => {
    const archived = toggleProjectArchived(initialState, 'vistafor')
    const restored = toggleProjectArchived(archived, 'vistafor')

    expect(archived.projects.find((project) => project.id === 'vistafor')?.archived).toBe(true)
    expect(archived.tasks.filter((task) => task.project === 'VistaFor')).toHaveLength(3)
    expect(restored.projects.find((project) => project.id === 'vistafor')?.archived).toBe(false)
  })

  it('mantém aliases e módulos únicos, normalizados e removíveis', () => {
    const withAlias = addProjectAlias(initialState, 'vistafor', ' PAX ')
    const duplicateAlias = addProjectAlias(withAlias, 'vistafor', 'pax')
    const withModule = addProjectModule(duplicateAlias, 'vistafor', ' Loteamentos / Mapa ')
    const duplicateModule = addProjectModule(withModule, 'vistafor', 'loteamentos / mapa')
    const removed = removeProjectAlias(removeProjectModule(removeProjectModule(removeProjectModule(duplicateModule, 'vistafor', 'PAX'), 'vistafor', 'API'), 'vistafor', 'Loteamentos / Mapa'), 'vistafor', 'pax')

    expect(withAlias.projects.find((project) => project.id === 'vistafor')?.aliases).toEqual(['PAX'])
    expect(duplicateAlias).toBe(withAlias)
    expect(withModule.projects.find((project) => project.id === 'vistafor')?.modules).toEqual(['Loteamentos / Mapa', 'API'])
    expect(duplicateModule).toBe(withModule)
    expect(removed.projects.find((project) => project.id === 'vistafor')).toMatchObject({ aliases: [], modules: [] })
  })

  it('edita card sem perder status, marcos ou origem e rejeita título/projeto inválido', () => {
    const updated = updateTask(initialState, 'task-1', {
      title: '  Corrigir exclusão no mapa  ',
      module: '  API  ',
      priority: 'P1',
      due: '30/07',
    })
    const rejected = updateTask(updated, 'task-1', { title: '   ' })
    const invalidProject = updateTask(updated, 'task-1', { project: 'Inexistente' })

    expect(updated.tasks.find((task) => task.id === 'task-1')).toMatchObject({
      title: 'Corrigir exclusão no mapa',
      module: 'API',
      priority: 'P1',
      due: '30/07',
      status: 'Backlog',
    })
    expect(updated.actionPlan.find((task) => task.id === 'task-1')?.title).toBe('Corrigir exclusão no mapa')
    expect(rejected).toBe(updated)
    expect(invalidProject).toBe(updated)
  })

  it('cria projeto com nome único e rejeita nome vazio ou duplicado', () => {
    const created = addProject(initialState, {
      name: '  Novo produto  ',
      description: '  Projeto piloto.  ',
      color: '#ff6b6b',
      priority: 'P2',
    })
    const duplicate = addProject(created, {
      name: 'novo produto',
      description: '',
      color: '#fff',
      priority: 'P3',
    })
    const empty = addProject(initialState, {
      name: '   ',
      description: '',
      color: '#fff',
      priority: 'P3',
    })

    expect(created.projects[0]).toMatchObject({
      name: 'Novo produto',
      description: 'Projeto piloto.',
      color: '#ff6b6b',
      priority: 'P2',
      progress: 0,
    })
    expect(duplicate).toBe(created)
    expect(empty).toBe(initialState)
  })

  it('cria tarefa manual no Backlog e rejeita projeto inválido', () => {
    const created = addTask(initialState, {
      title: '  Preparar homologação  ',
      project: 'VistaFor',
      module: 'Mapa',
      priority: 'P1',
      due: '30/07',
    })
    const task = created.tasks[0]
    const invalid = addTask(initialState, { title: 'Tarefa órfã', project: 'Inexistente' })

    expect(task).toMatchObject({
      title: 'Preparar homologação',
      project: 'VistaFor',
      module: 'Mapa',
      kind: 'Tarefa',
      status: 'Backlog',
      priority: 'P1',
      due: '30/07',
      duration: 'A estimar',
    })
    expect(created.actionPlan[0].id).toBe(task.id)
    expect(invalid).toBe(initialState)
  })

  it('completar tarefa tira tarefa do plano ativo sem apagar histórico', () => {
    const result = completeTask(initialState, 'task-1')
    expect(result.tasks.find((task) => task.id === 'task-1')?.status).toBe('Concluída')
    expect(result.actionPlan.some((task) => task.id === 'task-1')).toBe(false)
    expect(result.activity[0]).toContain('concluída')
  })

  it('capturar entrada adiciona item novo na caixa de entrada', () => {
    const result = addInboxItem(initialState, 'Ligar para equipe do PAX')
    expect(result.inbox[0]).toMatchObject({
      text: 'Ligar para equipe do PAX',
      source: 'Texto',
      status: 'Recebida',
    })
  })

  it('analisa demanda usando contexto e mantém evidências para revisão', () => {
    const captured = addInboxItem(
      initialState,
      'A planta principal continua carregando automaticamente e travando o mapa. Prioridade alta.',
    )
    const result = analyzeInboxItem(captured, captured.inbox[0].id)

    expect(result.inbox[0]).toMatchObject({
      status: 'Aguardando confirmação',
      suggestion: {
        project: 'VistaFor',
        module: 'Loteamentos / Mapa',
        kind: 'Bug',
        priority: 'P1',
        confidence: 93,
      },
    })
    expect(result.inbox[0].suggestion?.evidence.length).toBeGreaterThan(1)
    expect(result.inbox[0].suggestion?.duplicates[0].toLocaleLowerCase()).toContain('raster')
  })

  it('confirma correções manuais e cria uma única tarefa no Backlog', () => {
    const captured = addInboxItem(initialState, 'Revisar lentidão do mapa')
    const analyzed = analyzeInboxItem(captured, captured.inbox[0].id)
    const corrected = updateInboxSuggestion(analyzed, captured.inbox[0].id, {
      title: 'Otimizar carregamento inicial do mapa',
      project: 'Observa SEUMA',
      module: 'Mapa de processos',
      kind: 'Melhoria',
      priority: 'P1',
    })
    const confirmed = confirmInboxItem(corrected, captured.inbox[0].id)
    const repeated = confirmInboxItem(confirmed, captured.inbox[0].id)
    const created = repeated.tasks.filter((task) => task.sourceInboxId === captured.inbox[0].id)

    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({
      title: 'Otimizar carregamento inicial do mapa',
      project: 'Observa SEUMA',
      module: 'Mapa de processos',
      kind: 'Melhoria',
      priority: 'P1',
      status: 'Backlog',
    })
    expect(repeated.inbox[0].status).toBe('Processada')
  })

  it('trocar seção não duplica tarefas nem altera fonte compartilhada', () => {
    const snapshot: AppState = JSON.parse(JSON.stringify(initialState))
    expect(snapshot.tasks).toHaveLength(initialState.tasks.length)
    expect(snapshot.projects.map((project) => project.name)).toEqual(['VistaFor', 'Observa SEUMA', 'Intranet', 'App Vistoria'])
  })

  it('filter spreadsheet finds task by text, project and status', () => {
    const result = filterTasks(initialState.tasks, { query: 'medidas', project: 'VistaFor', status: 'Backlog' })
    expect(result.map((task) => task.id)).toEqual(['task-1'])
  })

  it('moving task in Kanban updates shared sources', () => {
    const result = moveTask(initialState, 'task-1', 'Em andamento')
    expect(result.tasks.find((task) => task.id === 'task-1')?.status).toBe('Em andamento')
    expect(result.actionPlan.find((task) => task.id === 'task-1')?.status).toBe('Em andamento')
  })

  it('grouping tasks in Kanban preserves every record once', () => {
    const groups = groupTasksByStatus(initialState.tasks)
    const grouped = Object.values(groups).flat()
    expect(grouped.map((task) => task.id).sort()).toEqual(initialState.tasks.map((task) => task.id).sort())
  })

  it('vincula uma tarefa a vários marcos somente dentro do mesmo projeto', () => {
    const result = setTaskMilestones(initialState, 'task-1', ['milestone-vistafor-mvp', 'milestone-vistafor-homologacao', 'milestone-observa-dashboard'])

    expect(result.tasks.find((task) => task.id === 'task-1')?.milestoneIds).toEqual([
      'milestone-vistafor-mvp',
      'milestone-vistafor-homologacao',
    ])
    expect(result.actionPlan.find((task) => task.id === 'task-1')?.milestoneIds).toEqual([
      'milestone-vistafor-mvp',
      'milestone-vistafor-homologacao',
    ])
  })

  it('filtra Kanban por marco e mantém uma visão explícita de tarefas sem marco', () => {
    const linked = filterTasksByMilestone(initialState.tasks, 'milestone-vistafor-mvp')
    const unassigned = filterTasksByMilestone(initialState.tasks, 'unassigned')

    expect(linked.map((task) => task.id)).toEqual(['task-1', 'task-2'])
    expect(unassigned.map((task) => task.id)).toEqual(['task-4', 'task-6'])
  })

  it('calcula progresso do marco pelas tarefas vinculadas sem contar canceladas como concluídas', () => {
    const state = {
      ...initialState,
      tasks: initialState.tasks.map((task) => task.id === 'task-1' ? { ...task, status: 'Concluída' as const } : task),
    }
    const milestone = state.milestones.find((item) => item.id === 'milestone-vistafor-mvp')!

    expect(getMilestoneProgress(milestone, state.tasks)).toEqual({
      completed: 1,
      total: 2,
      percentage: 50,
    })
  })

  it('cria marco somente para projeto válido e limpa vínculos ao remover', () => {
    const ignored = addMilestone(initialState, {
      name: '   ',
      project: 'VistaFor',
      targetDate: '2026-08-10',
      description: '',
    })
    const created = addMilestone(initialState, {
      name: 'Publicação controlada',
      project: 'VistaFor',
      targetDate: '2026-08-10',
      description: 'Liberar versão para grupo piloto.',
    })
    const milestone = created.milestones[0]
    const linked = setTaskMilestones(created, 'task-1', [milestone.id])
    const removed = removeMilestone(linked, milestone.id)

    expect(ignored).toBe(initialState)
    expect(milestone).toMatchObject({
      name: 'Publicação controlada',
      project: 'VistaFor',
      status: 'Planejado',
    })
    expect(removed.milestones.some((item) => item.id === milestone.id)).toBe(false)
    expect(removed.tasks.find((task) => task.id === 'task-1')?.milestoneIds).toEqual([])
    expect(removed.actionPlan.find((task) => task.id === 'task-1')?.milestoneIds).toEqual([])
  })

  it('edita dados do marco sem alterar projeto e rejeita data-alvo vazia', () => {
    const milestone = initialState.milestones.find((item) => item.id === 'milestone-vistafor-mvp')!
    const updated = updateMilestone(initialState, milestone.id, {
      name: '  MVP revisado  ',
      startDate: '2026-07-21',
      targetDate: '2026-08-01',
      status: 'Adiado',
      description: '  Validar novo escopo antes da entrega.  ',
    })
    const rejected = updateMilestone(updated, milestone.id, { targetDate: '' })

    expect(updated.milestones.find((item) => item.id === milestone.id)).toMatchObject({
      name: 'MVP revisado',
      project: 'VistaFor',
      startDate: '2026-07-21',
      targetDate: '2026-08-01',
      status: 'Adiado',
      description: 'Validar novo escopo antes da entrega.',
      color: milestone.color,
    })
    expect(rejected).toBe(updated)
  })

  it('cria nota manual privada e ignora conteúdo vazio', () => {
    const created = addNote(initialState, {
      title: 'Decisão da reunião',
      content: '  Validar novo fluxo com a equipe.  ',
    })
    const ignored = addNote(created, { title: '', content: '   ' })

    expect(created.notes[0]).toMatchObject({
      title: 'Decisão da reunião',
      content: 'Validar novo fluxo com a equipe.',
      visibility: 'Privada',
      availableToAi: false,
      availableToMcp: false,
    })
    expect(ignored).toBe(created)
  })

  it('converte nota em um único card e exige projeto válido', () => {
    const withNote = addNote(initialState, {
      title: 'Revisar painel ambiental',
      content: 'Conferir indicadores antes da publicação.',
    })
    const note = withNote.notes[0]
    const withoutProject = convertNoteToTask(withNote, note.id, '')
    const converted = convertNoteToTask(withNote, note.id, 'Observa SEUMA')
    const repeated = convertNoteToTask(converted, note.id, 'Observa SEUMA')
    const created = repeated.tasks.filter((task) => task.sourceNoteId === note.id)

    expect(withoutProject).toBe(withNote)
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({
      title: 'Revisar painel ambiental',
      project: 'Observa SEUMA',
      status: 'Backlog',
      priority: 'P3',
      kind: 'Tarefa',
    })
    expect(repeated.notes[0].convertedTaskId).toBe(created[0].id)
  })

  it('fixa e desafixa nota sem perder conteúdo', () => {
    const withNote = addNote(initialState, {
      title: 'Planejar próxima entrega',
      content: 'Listar riscos antes da reunião.',
    })
    const note = withNote.notes[0]
    const pinned = toggleNotePinned(withNote, note.id)
    const unpinned = toggleNotePinned(pinned, note.id)

    expect(pinned.notes[0]).toMatchObject({
      title: note.title,
      content: note.content,
      pinned: true,
    })
    expect(unpinned.notes[0].pinned).toBe(false)
  })

  it('busca notas por título ou conteúdo sem alterar lista original', () => {
    const first = addNote(initialState, {
      title: 'VistaFor',
      content: 'Revisar permissões do mapa.',
    })
    const second = addNote(first, {
      title: 'Observa',
      content: 'Conferir indicadores ambientais.',
    })

    expect(filterNotes(second.notes, 'mapa').map((note) => note.title)).toEqual(['VistaFor'])
    expect(filterNotes(second.notes, 'OBSERVA').map((note) => note.title)).toEqual(['Observa'])
    expect(second.notes).toHaveLength(2)
  })

  it('edita título e conteúdo sem perder privacidade ou pinagem', () => {
    const withNote = addNote(initialState, {
      title: 'Rascunho',
      content: 'Texto inicial.',
    })
    const pinned = toggleNotePinned(withNote, withNote.notes[0].id)
    const updated = updateNote(pinned, withNote.notes[0].id, {
      title: '  Decisão final  ',
      content: '  Texto revisado.  ',
    })
    const rejected = updateNote(updated, withNote.notes[0].id, {
      title: 'Sem conteúdo',
      content: '   ',
    })

    expect(updated.notes[0]).toMatchObject({
      title: 'Decisão final',
      content: 'Texto revisado.',
      pinned: true,
      visibility: 'Privada',
      availableToAi: false,
      availableToMcp: false,
    })
    expect(rejected).toBe(updated)
  })
})
