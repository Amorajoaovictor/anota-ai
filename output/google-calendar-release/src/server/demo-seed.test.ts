import { describe, expect, it } from 'vitest'
import { seedDemo } from './demo-seed'

type Row = Record<string, any>

function createDemoStore() {
  const projects: Row[] = []
  const modules: Row[] = []
  const tasks: Row[] = []
  const milestones: Row[] = []
  const inboxItems: Row[] = []
  const tags: Row[] = []
  const notes: Row[] = []
  const contexts: Row[] = []
  const aliases = new Set<string>()
  const dependencies = new Set<string>()
  const milestoneLinks = new Set<string>()
  const tagLinks = new Set<string>()

  const update = (row: Row, data: Row) => Object.assign(row, data)

  return {
    data: { projects, modules, tasks, milestones, inboxItems, tags, notes, contexts, aliases, dependencies, milestoneLinks, tagLinks },
    prisma: {
      project: {
        async findUnique({ where }: any) {
          const key = where.ownerId_name
          return projects.find((project) => project.ownerId === key.ownerId && project.name === key.name) ?? null
        },
        async create({ data }: any) {
          const row = { id: `project-${projects.length + 1}`, ...data }
          projects.push(row)
          return row!
        },
        async update({ where, data }: any) {
          const row = projects.find((project) => project.id === where.id)!
          return update(row, data)
        },
      },
      projectAlias: {
        async upsert({ where }: any) {
          aliases.add(`${where.projectId_value.projectId}:${where.projectId_value.value}`)
        },
      },
      projectModule: {
        async upsert({ where, create }: any) {
          const key = where.projectId_name
          let row = modules.find((module) => module.projectId === key.projectId && module.name === key.name)
          if (!row) {
            row = { id: `module-${modules.length + 1}`, ...create }
            modules.push(row!)
          }
          return row!
        },
      },
      projectTag: {
        async upsert({ where, create, update: patch }: any) {
          const key = where.projectId_name
          let row = tags.find((tag) => tag.projectId === key.projectId && tag.name === key.name)
          if (!row) {
            row = { id: `tag-${tags.length + 1}`, projectId: key.projectId, ...create }
            tags.push(row!)
          } else {
            update(row, patch)
          }
          return row!
        },
      },
      projectContext: {
        async findFirst({ where }: any) {
          return contexts.find((context) => context.projectId === where.projectId && context.title === where.title) ?? null
        },
        async create({ data }: any) {
          const row = { id: `context-${contexts.length + 1}`, ...data }
          contexts.push(row)
          return row
        },
        async update({ where, data }: any) {
          return update(contexts.find((context) => context.id === where.id)!, data)
        },
      },
      note: {
        async findFirst({ where }: any) {
          return notes.find((note) => note.ownerId === where.ownerId && note.projectId === where.projectId && note.title === where.title) ?? null
        },
        async create({ data }: any) {
          const row = { id: `note-${notes.length + 1}`, ...data }
          notes.push(row)
          return row
        },
        async update({ where, data }: any) {
          return update(notes.find((note) => note.id === where.id)!, data)
        },
      },
      taskTag: {
        async upsert({ where }: any) {
          tagLinks.add(`${where.taskId_tagId.taskId}:${where.taskId_tagId.tagId}`)
        },
      },
      task: {
        async findFirst({ where }: any) {
          return tasks.find((task) => task.projectId === where.projectId && task.title === where.title) ?? null
        },
        async create({ data }: any) {
          const row = { id: `task-${tasks.length + 1}`, ...data }
          tasks.push(row)
          return row
        },
        async update({ where, data }: any) {
          return update(tasks.find((task) => task.id === where.id)!, data)
        },
      },
      taskDependency: {
        async upsert({ where }: any) {
          dependencies.add(`${where.taskId_dependsOnId.taskId}:${where.taskId_dependsOnId.dependsOnId}`)
        },
      },
      milestone: {
        async findFirst({ where }: any) {
          return milestones.find((milestone) => milestone.projectId === where.projectId && milestone.name === where.name) ?? null
        },
        async create({ data }: any) {
          const row = { id: `milestone-${milestones.length + 1}`, ...data }
          milestones.push(row)
          return row
        },
        async update({ where, data }: any) {
          return update(milestones.find((milestone) => milestone.id === where.id)!, data)
        },
      },
      taskMilestone: {
        async upsert({ where }: any) {
          milestoneLinks.add(`${where.taskId_milestoneId.taskId}:${where.taskId_milestoneId.milestoneId}`)
        },
      },
      inboxItem: {
        async findFirst({ where }: any) {
          return inboxItems.find((item) => item.ownerId === where.ownerId && item.source === where.source && item.text === where.text) ?? null
        },
        async create({ data }: any) {
          const row = { id: `inbox-${inboxItems.length + 1}`, ...data }
          inboxItems.push(row)
          return row
        },
        async update({ where, data }: any) {
          return update(inboxItems.find((item) => item.id === where.id)!, data)
        },
      },
    },
  }
}

describe('seed de demonstração', () => {
  it('grava toda base demo persistível e pode ser repetido sem duplicar', async () => {
    const store = createDemoStore()

    await seedDemo(store.prisma as any, 'owner-1')
    await seedDemo(store.prisma as any, 'owner-1')

    expect(store.data.projects).toHaveLength(4)
    expect(store.data.tasks).toHaveLength(6)
    expect(store.data.milestones).toHaveLength(4)
    expect(store.data.inboxItems).toHaveLength(2)
    expect(store.data.dependencies.size).toBe(1)
    expect(store.data.milestoneLinks.size).toBe(5)
    expect(store.data.tags).toHaveLength(4)
    expect(store.data.tagLinks.size).toBe(4)
    expect(store.data.notes).toHaveLength(2)
    expect(store.data.contexts).toHaveLength(2)
    expect(store.data.inboxItems[0]).toMatchObject({ ownerId: 'owner-1', source: 'TEXT', status: 'AWAITING_CONFIRMATION' })
  })

  it('nota e contexto guardam o id real do card e do projeto, não o id da base demo', async () => {
    const store = createDemoStore()

    await seedDemo(store.prisma as any, 'owner-1')

    const note = store.data.notes.find((row) => row.title.startsWith('Conferir com a CEGEO'))!
    const context = store.data.contexts.find((row) => row.title.startsWith('Planta principal'))!
    const card = store.data.tasks.find((row) => row.title === 'Corrigir exclusão de medidas')!
    const blocked = store.data.tasks.find((row) => row.title === 'Reproduzir erro e registrar resposta da API')!

    expect(note.projectId).toBe(card.projectId)
    expect(note.taskId).toBe(card.id)
    expect(context.taskId).toBe(blocked.id)
    // Etiqueta vinculada usa o id gravado, não o `tag-vistafor-*` da base demo.
    expect([...store.data.tagLinks].every((link) => store.data.tags.some((tag) => link.endsWith(`:${tag.id}`)))).toBe(true)
  })

  it('grava descrição e previsão do card', async () => {
    const store = createDemoStore()

    await seedDemo(store.prisma as any, 'owner-1')

    expect(store.data.tasks.find((row) => row.title === 'Corrigir exclusão de medidas')).toMatchObject({
      description: 'Excluir uma medida no mapa não remove o registro correspondente na API.',
      forecastAt: expect.stringContaining('-07-29'),
    })
  })
})
