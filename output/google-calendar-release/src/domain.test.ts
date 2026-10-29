import { describe, expect, it } from 'vitest'
import {
  addContext,
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
  removeContext,
  removeMilestone,
  reorderNotes,
  setProjectTags,
  setTaskMilestones,
  setTaskTags,
  suggestForecast,
  toggleNotePinned,
  taskTags,
  updateContext,
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
  globalScope,
  projectScope,
  scopeContexts,
  scopeMilestones,
  scopeNotes,
  scopeProject,
  scopeProjects,
  scopeTasks,
  searchAll,
  sortActionPlanByPriority,
  suggestTaskFields,
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
    })
    // Fase 0 do PRD: complexidade nasce vazia até a análise da IA.
    expect(task.complexity).toBeUndefined()
    expect(created.actionPlan[0].id).toBe(task.id)
    expect(invalid).toBe(initialState)
  })

  it('cria tarefa com status, tipo e marco vindos do contexto da tela', () => {
    const created = addTask(initialState, {
      title: 'Revisar fluxo do mapa',
      project: 'VistaFor',
      status: 'Em andamento',
      kind: 'Melhoria',
      due: '31/07',
      milestoneIds: ['milestone-vistafor-mvp'],
    })
    const task = created.tasks[0]

    expect(task).toMatchObject({
      status: 'Em andamento',
      kind: 'Melhoria',
      due: '31/07',
      milestoneIds: ['milestone-vistafor-mvp'],
    })
    expect(created.actionPlan[0].id).toBe(task.id)
  })

  it('descarta marco de outro projeto sem impedir a criação e mantém card fechado fora do plano', () => {
    const outroProjeto = addTask(initialState, {
      title: 'Ajustar permissões',
      project: 'Intranet',
      milestoneIds: ['milestone-vistafor-mvp', 'milestone-inexistente', 'milestone-intranet-acessos'],
    })
    const concluida = addTask(initialState, { title: 'Registro retroativo', project: 'VistaFor', status: 'Concluída' })
    const comIntranetArquivada = toggleProjectArchived(initialState, 'intranet')
    const arquivado = addTask(comIntranetArquivada, { title: 'Card órfão', project: 'Intranet' })
    const semTitulo = addTask(initialState, { title: '   ', project: 'VistaFor' })

    expect(outroProjeto.tasks[0].milestoneIds).toEqual(['milestone-intranet-acessos'])
    expect(concluida.tasks[0].status).toBe('Concluída')
    expect(concluida.actionPlan.some((task) => task.id === concluida.tasks[0].id)).toBe(false)
    expect(arquivado).toBe(comIntranetArquivada)
    expect(semTitulo).toBe(initialState)
  })

  it('sugere campos opcionais sem sobrepor o projeto escolhido pelo usuário', () => {
    const noProjetoCerto = suggestTaskFields(initialState, { title: 'Corrigir planta do loteamento', project: 'VistaFor' })
    const noProjetoErrado = suggestTaskFields(initialState, { title: 'Corrigir planta do loteamento', project: 'Intranet' })
    const semTitulo = suggestTaskFields(initialState, { title: '  ', project: 'VistaFor' })

    expect(noProjetoCerto).toMatchObject({ module: 'Loteamentos / Mapa', kind: 'Melhoria', priority: 'P2' })
    expect(noProjetoErrado?.module).toBe('Geral')
    expect(semTitulo).toBe(null)
  })

  it('previsão sai da complexidade e nunca é o prazo', () => {
    const base = new Date('2026-07-28T00:00:00.000Z')

    expect(suggestForecast('Baixa', base)).toBe('30/07')
    expect(suggestForecast('Média', base)).toBe('02/08')
    expect(suggestForecast('Alta', base)).toBe('07/08')

    const sugerido = suggestTaskFields(initialState, { title: 'Corrigir planta do loteamento', project: 'VistaFor' }, base)
    expect(sugerido).toMatchObject({ complexity: 'Média', forecast: '02/08' })
  })

  it('grava descrição e previsão do card, e limpa quando vêm vazias', () => {
    const criado = addTask(initialState, {
      title: 'Ajustar planta',
      description: '  Trava ao abrir o mapa.  ',
      project: 'VistaFor',
      forecast: ' 04/08 ',
    })
    const limpo = updateTask(criado, criado.tasks[0].id, { description: '   ', forecast: '   ' })

    expect(criado.tasks[0]).toMatchObject({ description: 'Trava ao abrir o mapa.', forecast: '04/08' })
    expect(limpo.tasks[0].description).toBeUndefined()
    expect(limpo.tasks[0].forecast).toBeUndefined()
  })

  it('etiqueta é do projeto: lista vira conjunto e a que sai deixa os cards', () => {
    const comEtiquetas = setProjectTags(initialState, 'vistafor', [
      { name: ' raster ' },
      { name: 'RASTER' },
      { name: 'nova' },
    ])
    const projeto = comEtiquetas.projects.find((item) => item.id === 'vistafor')!

    // "RASTER" repete "raster" só no caixa; a etiqueta que já existia mantém o id.
    expect(projeto.tags.map((tag) => tag.name)).toEqual(['raster', 'nova'])
    expect(projeto.tags[0].id).toBe('tag-vistafor-raster')
    // "CEGEO" ficou fora da lista, então sai do projeto e do card que a usava.
    expect(projeto.tags.some((tag) => tag.name === 'CEGEO')).toBe(false)
    expect(comEtiquetas.tasks.find((task) => task.id === 'task-1')?.tagIds).toEqual([])
    expect(comEtiquetas.tasks.find((task) => task.id === 'task-2')?.tagIds).toEqual(['tag-vistafor-raster'])
  })

  it('vincula etiqueta ao card e descarta a de outro projeto', () => {
    const valida = setTaskTags(initialState, 'task-1', ['tag-vistafor-raster', 'tag-intranet-seguranca', 'tag-inexistente'])
    const semCard = setTaskTags(initialState, 'nao-existe', ['tag-vistafor-raster'])

    expect(valida.tasks.find((task) => task.id === 'task-1')?.tagIds).toEqual(['tag-vistafor-raster'])
    expect(taskTags(valida, valida.tasks.find((task) => task.id === 'task-1')!).map((tag) => tag.name)).toEqual(['raster'])
    expect(semCard).toBe(initialState)
  })

  it('trocar o projeto do card zera etiquetas e marcos, que são do projeto antigo', () => {
    const movido = updateTask(initialState, 'task-1', { project: 'Intranet' })
    const task = movido.tasks.find((item) => item.id === 'task-1')!

    expect(task.project).toBe('Intranet')
    expect(task.tagIds).toEqual([])
    expect(task.milestoneIds).toEqual([])
  })

  it('contexto exige projeto, título e conteúdo, e aceita card do mesmo projeto', () => {
    const criado = addContext(initialState, {
      projectId: 'vistafor',
      title: '  Medidas passam pela CEGEO  ',
      content: '  Regra combinada com a equipe.  ',
      taskId: 'task-1',
    })
    const cardDeOutroProjeto = addContext(initialState, {
      projectId: 'vistafor',
      title: 'Regra',
      content: 'Texto',
      taskId: 'task-3',
    })
    const semTitulo = addContext(initialState, { projectId: 'vistafor', title: '  ', content: 'Texto' })
    const semProjeto = addContext(initialState, { projectId: 'nao-existe', title: 'Regra', content: 'Texto' })

    expect(criado.contexts[0]).toMatchObject({
      projectId: 'vistafor',
      title: 'Medidas passam pela CEGEO',
      content: 'Regra combinada com a equipe.',
      taskId: 'task-1',
    })
    expect(cardDeOutroProjeto.contexts[0].taskId).toBeUndefined()
    expect(semTitulo).toBe(initialState)
    expect(semProjeto).toBe(initialState)
  })

  it('edita e remove contexto, e o escopo isola por projeto', () => {
    const criado = addContext(initialState, { projectId: 'intranet', title: 'Perfis', content: 'Texto inicial.' })
    const contextId = criado.contexts[0].id
    const editado = updateContext(criado, contextId, { title: 'Perfis revisados', content: 'Texto final.', taskId: 'task-3' })
    const vazio = updateContext(editado, contextId, { title: '   ', content: 'Texto', taskId: undefined })
    const removido = removeContext(editado, contextId)

    expect(editado.contexts[0]).toMatchObject({ title: 'Perfis revisados', content: 'Texto final.', taskId: 'task-3' })
    expect(vazio).toBe(editado)
    expect(removido.contexts.some((context) => context.id === contextId)).toBe(false)
    expect(scopeContexts(editado, projectScope('intranet')).map((context) => context.title)).toEqual(['Perfis revisados'])
    expect(scopeContexts(editado, projectScope('vistoria'))).toEqual([])
  })

  it('arrastar nota grava posição no meio dos vizinhos da mesma seção', () => {
    const base: AppState = {
      ...initialState,
      notes: [
        { ...initialState.notes[0], id: 'a', projectId: 'vistafor', pinned: false, position: 0 },
        { ...initialState.notes[0], id: 'b', projectId: 'vistafor', pinned: false, position: 1 },
        { ...initialState.notes[0], id: 'c', projectId: 'vistafor', pinned: false, position: 2 },
      ],
    }
    const meio = reorderNotes(base, 'c', 'b')
    const fim = reorderNotes(base, 'a')

    expect(meio.notes.map((note) => note.id)).toEqual(['a', 'c', 'b'])
    expect(meio.notes.find((note) => note.id === 'c')?.position).toBe(0.5)
    expect(fim.notes.map((note) => note.id)).toEqual(['b', 'c', 'a'])
    expect(fim.notes.find((note) => note.id === 'a')?.position).toBe(3)
  })

  it('nota nova entra na frente e aceita card do próprio projeto apenas', () => {
    const criada = addNote(initialState, { title: 'Nota', content: 'Texto', projectId: 'vistafor', taskId: 'task-1' })
    const cardDeOutroProjeto = addNote(initialState, { title: 'Nota', content: 'Texto', projectId: 'vistafor', taskId: 'task-3' })

    expect(criada.notes[0].taskId).toBe('task-1')
    expect(criada.notes[0].position).toBeLessThan(Math.min(...initialState.notes.map((note) => note.position)))
    expect(cardDeOutroProjeto.notes[0].taskId).toBeUndefined()
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
    const suggestion = result.inbox[0].suggestion
    expect(suggestion?.evidence.length).toBeGreaterThan(1)
    expect(suggestion && !('actions' in suggestion) ? suggestion.duplicates[0].toLocaleLowerCase() : '').toContain('raster')
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
      projectId: 'observa',
    })
    const ignored = addNote(created, { title: '', content: '   ', projectId: 'observa' })
    const withoutProject = addNote(created, { title: 'Solta', content: 'Sem projeto.', projectId: '' })

    expect(created.notes[0]).toMatchObject({
      title: 'Decisão da reunião',
      content: 'Validar novo fluxo com a equipe.',
      projectId: 'observa',
      visibility: 'Privada',
      availableToAi: false,
      availableToMcp: false,
    })
    expect(ignored).toBe(created)
    expect(withoutProject).toBe(created)
  })

  it('converte nota em um único card e exige projeto válido', () => {
    const withNote = addNote(initialState, {
      title: 'Revisar painel ambiental',
      content: 'Conferir indicadores antes da publicação.',
      projectId: 'observa',
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
      projectId: 'vistafor',
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
      projectId: 'vistafor',
    })
    const second = addNote(first, {
      title: 'Observa',
      content: 'Conferir indicadores ambientais.',
      projectId: 'observa',
    })

    expect(filterNotes(second.notes, 'mapa').map((note) => note.title)).toEqual(['VistaFor'])
    expect(filterNotes(second.notes, 'OBSERVA').map((note) => note.title)).toEqual(['Observa'])
    expect(second.notes).toHaveLength(initialState.notes.length + 2)
  })

  it('edita título e conteúdo sem perder privacidade ou pinagem', () => {
    const withNote = addNote(initialState, {
      title: 'Rascunho',
      content: 'Texto inicial.',
      projectId: 'intranet',
    })
    const pinned = toggleNotePinned(withNote, withNote.notes[0].id)
    const updated = updateNote(pinned, withNote.notes[0].id, {
      title: '  Decisão final  ',
      content: '  Texto revisado.  ',
      taskId: undefined,
    })
    const rejected = updateNote(updated, withNote.notes[0].id, {
      title: 'Sem conteúdo',
      content: '   ',
      taskId: undefined,
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

  it('escopo global entrega apenas dados de projetos ativos', () => {
    const archived = toggleProjectArchived(initialState, 'intranet')

    expect(scopeProject(archived, globalScope)).toBeUndefined()
    expect(scopeProjects(archived, globalScope).map((project) => project.id)).toEqual(['vistafor', 'observa', 'vistoria'])
    expect(scopeTasks(archived, globalScope).every((task) => task.project !== 'Intranet')).toBe(true)
    expect(scopeMilestones(archived, globalScope).every((milestone) => milestone.project !== 'Intranet')).toBe(true)
  })

  it('escopo de projeto isola tarefas, marcos e notas do projeto escolhido', () => {
    const withNotes = addNote(
      addNote(initialState, { title: 'Mapa', content: 'Revisar camadas.', projectId: 'vistafor' }),
      { title: 'Indicadores', content: 'Conferir séries.', projectId: 'observa' },
    )
    const scope = projectScope('vistafor')

    expect(scopeProject(withNotes, scope)?.name).toBe('VistaFor')
    expect(scopeTasks(withNotes, scope).every((task) => task.project === 'VistaFor')).toBe(true)
    expect(scopeMilestones(withNotes, scope).every((milestone) => milestone.project === 'VistaFor')).toBe(true)
    expect(scopeNotes(withNotes, scope).every((note) => note.projectId === 'vistafor')).toBe(true)
    expect(scopeNotes(withNotes, scope).map((note) => note.title)).toContain('Mapa')
    expect(scopeNotes(withNotes, globalScope)).toHaveLength(initialState.notes.length + 2)
  })

  it('projeto arquivado continua acessível quando o usuário navega direto para ele', () => {
    const archived = toggleProjectArchived(initialState, 'intranet')
    const scope = projectScope('intranet')

    expect(scopeProject(archived, scope)?.archived).toBe(true)
    expect(scopeTasks(archived, scope).map((task) => task.id)).toEqual(['task-3'])
  })

  it('escopo de projeto inexistente não vaza dados de outros projetos', () => {
    const scope = projectScope('nao-existe')

    expect(scopeProjects(initialState, scope)).toEqual([])
    expect(scopeTasks(initialState, scope)).toEqual([])
    expect(scopeMilestones(initialState, scope)).toEqual([])
  })

  it('busca vazia não retorna nada', () => {
    expect(searchAll(initialState, '')).toEqual([])
    expect(searchAll(initialState, '   ')).toEqual([])
  })

  it('busca por alias encontra o projeto pelo nome alternativo', () => {
    const hits = searchAll(initialState, 'PAX')
    expect(hits.some((hit) => hit.kind === 'project' && hit.title === 'VistaFor')).toBe(true)
  })

  it('busca por tarefa traz o projeto e o status no subtítulo', () => {
    const hits = searchAll(initialState, 'exclusão de medidas')
    const hit = hits.find((item) => item.kind === 'task')
    expect(hit?.title).toBe('Corrigir exclusão de medidas')
    expect(hit?.subtitle).toContain('VistaFor')
    expect(hit?.subtitle).toContain('Backlog')
  })

  it('busca por nota resolve o nome do projeto pelo projectId', () => {
    const hits = searchAll(initialState, 'CEGEO antes de mexer')
    const hit = hits.find((item) => item.kind === 'note')
    expect(hit?.subtitle).toBe('VistaFor')
  })

  it('teto por grupo limita cada tipo separadamente', () => {
    const hits = searchAll(initialState, 'a', 1)
    const perGroup = new Map<string, number>()
    for (const hit of hits) perGroup.set(hit.kind, (perGroup.get(hit.kind) ?? 0) + 1)
    for (const count of perGroup.values()) expect(count).toBeLessThanOrEqual(1)
  })

  it('prefixo exato aparece antes de substring dentro do mesmo grupo', () => {
    const hits = searchAll(initialState, 'vis', 10)
    const projectHits = hits.filter((hit) => hit.kind === 'project').map((hit) => hit.title)
    expect(projectHits).toEqual(['VistaFor', 'App Vistoria'])
  })

  it('ordena o plano por prioridade e, dentro dela, por prazo mais próximo', () => {
    const state: AppState = {
      ...initialState,
      actionPlan: [
        { ...initialState.tasks[3]!, priority: 'P2', due: '30/07' },
        { ...initialState.tasks[0]!, priority: 'P0', due: '24/07' },
        { ...initialState.tasks[2]!, priority: 'P1', due: '24/07' },
        { ...initialState.tasks[4]!, priority: 'P2', due: '20/07' },
      ],
    }
    const sorted = sortActionPlanByPriority(state)
    expect(sorted.actionPlan.map((task) => task.priority)).toEqual(['P0', 'P1', 'P2', 'P2'])
    const p2 = sorted.actionPlan.filter((task) => task.priority === 'P2')
    expect(p2.map((task) => task.due)).toEqual(['20/07', '30/07'])
  })

  it('tarefa sem prazo vai para o fim do próprio grupo de prioridade', () => {
    const state: AppState = {
      ...initialState,
      actionPlan: [
        { ...initialState.tasks[4]!, priority: 'P2', due: '20/07' },
        { ...initialState.tasks[3]!, priority: 'P2', due: undefined },
      ],
    }
    const sorted = sortActionPlanByPriority(state)
    expect(sorted.actionPlan.map((task) => task.due)).toEqual(['20/07', undefined])
  })
})
