import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { getHarnessReadModel } from '../ai/harness/read-model'
import { createContext, listContexts, removeContext, updateContext } from '../contexts'
import { captureInboxText, confirmInboxItem, discardInboxItem, listInboxItems } from '../inbox'
import { createProject, listProjects, updateProject } from '../projects'
import { createTask, listTasks, updateTask } from '../tasks'

export type McpCaller = { ownerId: string; repository: PrismaClient }

const idInput = z.object({ id: z.string().trim().min(1) })
const searchInput = z.object({ query: z.string().trim().min(1).max(200) })
const pageInput = z.object({ limit: z.number().int().min(1).max(100).default(50), offset: z.number().int().min(0).max(100_000).default(0) })

function page(args: Record<string, unknown>) {
  const parsed = pageInput.parse(args)
  return { take: parsed.limit, skip: parsed.offset }
}

function requireConfirmation(args: Record<string, unknown>, sensitive = false) {
  if (args.confirmed !== true || (sensitive && args.confirmedSensitive !== true)) {
    throw new Error('CONFIRMATION_REQUIRED')
  }
}

function objectInput(args: Record<string, unknown>, key: string) {
  const value = args[key]
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`INVALID_INPUT: ${key}`)
  return value as Record<string, unknown>
}

export async function callMcpTool(name: string, args: Record<string, unknown>, caller: McpCaller) {
  const { repository, ownerId } = caller
  switch (name) {
    case 'projects.list': return { projects: await listProjects(repository, ownerId, page(args)) }
    case 'projects.get': {
      const { id } = idInput.parse(args)
      return { project: await repository.project.findFirst({ where: { id, ownerId }, include: { aliases: true, modules: true, tags: true } }) }
    }
    case 'projects.create': {
      requireConfirmation(args, args.priority === 'P0' || args.priority === 'P1')
      const { confirmed: _, confirmedSensitive: __, ...input } = args
      return createProject(repository, ownerId, input)
    }
    case 'projects.update': {
      const { id } = idInput.parse(args)
      const patch = objectInput(args, 'patch')
      requireConfirmation(args, patch.archived === true || 'priority' in patch)
      return updateProject(repository, ownerId, id, patch)
    }
    case 'tasks.list': return { tasks: await listTasks(repository, ownerId, page(args)) }
    case 'tasks.get': {
      const { id } = idInput.parse(args)
      return { task: await repository.task.findFirst({ where: { id, project: { ownerId } }, include: { project: true, module: true, dependsOn: true } }) }
    }
    case 'tasks.search_similar': {
      const { query } = searchInput.parse(args)
      const projectId = args.projectId === undefined ? undefined : z.string().trim().min(1).parse(args.projectId)
      const words = [...new Set(query.split(/\s+/u).map((word) => word.trim()).filter((word) => word.length >= 3))].slice(0, 8)
      const terms = words.length ? words : [query]
      const tasks = await repository.task.findMany({
        where: { project: { ownerId }, ...(projectId ? { projectId } : {}),
          OR: terms.flatMap((term) => [{ title: { contains: term, mode: 'insensitive' as const } }, { description: { contains: term, mode: 'insensitive' as const } }]),
        },
        orderBy: { updatedAt: 'desc' }, take: 100,
      })
      const ranked = tasks.map((task) => ({ task, score: terms.reduce((score, term) => {
        const lower = term.toLocaleLowerCase('pt-BR')
        return score + (task.title.toLocaleLowerCase('pt-BR').includes(lower) ? 2 : 0)
          + (task.description.toLocaleLowerCase('pt-BR').includes(lower) ? 1 : 0)
      }, 0) }))
      ranked.sort((a, b) => b.score - a.score)
      return { tasks: ranked.slice(0, 20) }
    }
    case 'tasks.create': {
      const input = objectInput(args, 'task')
      requireConfirmation(args, input.dueAt != null || input.forecastAt != null || input.priority === 'P0' || input.priority === 'P1')
      return createTask(repository, ownerId, input)
    }
    case 'tasks.update': {
      const { id } = idInput.parse(args)
      const patch = objectInput(args, 'patch')
      requireConfirmation(args, 'dueAt' in patch || 'forecastAt' in patch || 'priority' in patch)
      return updateTask(repository, ownerId, id, patch)
    }
    case 'context.list': return { contexts: await listContexts(repository, ownerId, page(args)) }
    case 'context.search': {
      const { query } = searchInput.parse(args)
      return { contexts: await repository.projectContext.findMany({
        where: { project: { ownerId }, OR: [{ title: { contains: query, mode: 'insensitive' } }, { content: { contains: query, mode: 'insensitive' } }] },
        orderBy: { createdAt: 'desc' }, take: 50,
      }) }
    }
    case 'context.create': {
      requireConfirmation(args, true)
      return createContext(repository, ownerId, objectInput(args, 'context'))
    }
    case 'context.update': {
      const { id } = idInput.parse(args)
      requireConfirmation(args, true)
      return updateContext(repository, ownerId, id, objectInput(args, 'patch'))
    }
    case 'context.delete': {
      const { id } = idInput.parse(args)
      requireConfirmation(args, true)
      return removeContext(repository, ownerId, id)
    }
    case 'inbox.list': return { inbox: await listInboxItems(repository, ownerId, page(args)) }
    case 'inbox.get': {
      const { id } = idInput.parse(args)
      return { inboxItem: await repository.inboxItem.findFirst({ where: { id, ownerId }, include: { aiRuns: { orderBy: { createdAt: 'desc' }, take: 1 } } }) }
    }
    case 'inbox.harness': {
      const { id } = idInput.parse(args)
      return getHarnessReadModel(repository, ownerId, id)
    }
    case 'inbox.create': {
      requireConfirmation(args)
      return captureInboxText(repository, ownerId, { text: args.text }, 'MCP')
    }
    case 'inbox.discard': {
      const { id } = idInput.parse(args)
      requireConfirmation(args, true)
      return discardInboxItem(repository, ownerId, id)
    }
    case 'inbox.confirm': {
      const { id } = idInput.parse(args)
      const task = objectInput(args, 'task')
      requireConfirmation(args, task.dueAt != null || task.forecastAt != null || task.priority === 'P0' || task.priority === 'P1')
      return confirmInboxItem(repository, ownerId, id, task)
    }
    default: throw new Error(`Ferramenta MCP desconhecida: ${name}`)
  }
}
