import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod-v4'
import { getPrisma } from '../../lib/prisma'
import { callMcpTool } from './tools'

export type McpIdentity = { ownerId: string; tokenId: string; scopes: string[]; requestId?: string }

const id = z.string().trim().min(1)
const confirm = {
  confirmed: z.literal(true).describe('Defina true somente depois que o usuário confirmar a ação na conversa.'),
  confirmedSensitive: z.boolean().optional().describe('Exigido para prazo, prioridade alta, arquivamento, descarte e memória de contexto.'),
}
const fields = z.record(z.string(), z.unknown())
const paging = { limit: z.number().int().min(1).max(100).optional(), offset: z.number().int().min(0).max(100_000).optional() }

const definitions = [
  { name: 'projects.list', scope: 'read', description: 'Lista projetos do usuário em páginas de até 100.', schema: z.object(paging) },
  { name: 'projects.get', scope: 'read', description: 'Consulta projeto pelo ID.', schema: z.object({ id }) },
  { name: 'projects.create', scope: 'create', description: 'Cria projeto após confirmação do usuário.', schema: z.object({ name: z.string().min(1), description: z.string().optional(), color: z.string().optional(), priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional(), ...confirm }) },
  { name: 'projects.update', scope: 'update', description: 'Edita projeto. Peça confirmação reforçada para arquivar ou prioridade alta.', schema: z.object({ id, patch: fields, ...confirm }) },
  { name: 'tasks.list', scope: 'read', description: 'Lista cards do usuário em páginas de até 100.', schema: z.object(paging) },
  { name: 'tasks.get', scope: 'read', description: 'Consulta card pelo ID.', schema: z.object({ id }) },
  { name: 'tasks.search_similar', scope: 'read', description: 'Busca cards relacionados por palavras no título e descrição, com filtro opcional de projeto.', schema: z.object({ query: z.string().min(1).max(200), projectId: id.optional() }) },
  { name: 'tasks.create', scope: 'create', description: 'Cria card. Confirme com usuário; prazo e prioridade alta exigem confirmação reforçada.', schema: z.object({ task: fields, ...confirm }) },
  { name: 'tasks.update', scope: 'update', description: 'Edita card ou move status. Mudanças de prazo e prioridade alta exigem confirmação reforçada.', schema: z.object({ id, patch: fields, ...confirm }) },
  { name: 'context.list', scope: 'read', description: 'Lista contexto compartilhado com IA em páginas; notas privadas ficam fora.', schema: z.object(paging) },
  { name: 'context.search', scope: 'read', description: 'Busca contexto do usuário pelo texto.', schema: z.object({ query: z.string().min(1).max(200) }) },
  { name: 'context.create', scope: 'context', description: 'Registra memória de projeto após confirmação reforçada do usuário.', schema: z.object({ context: fields, ...confirm }) },
  { name: 'context.update', scope: 'context', description: 'Edita memória de projeto após confirmação reforçada do usuário.', schema: z.object({ id, patch: fields, ...confirm }) },
  { name: 'context.delete', scope: 'context', description: 'Exclui memória de projeto após confirmação reforçada do usuário.', schema: z.object({ id, ...confirm }) },
  { name: 'inbox.list', scope: 'read', description: 'Lista entradas da caixa de entrada em páginas.', schema: z.object(paging) },
  { name: 'inbox.get', scope: 'read', description: 'Consulta entrada e última revisão IA.', schema: z.object({ id }) },
  { name: 'inbox.harness', scope: 'read', description: 'Consulta estado completo da Revisão IA da entrada.', schema: z.object({ id }) },
  { name: 'inbox.create', scope: 'create', description: 'Captura texto na caixa de entrada após confirmação do usuário.', schema: z.object({ text: z.string().min(1), ...confirm }) },
  { name: 'inbox.confirm', scope: 'create', description: 'Confirma classificação legada da entrada e cria card após confirmação do usuário.', schema: z.object({ id, task: fields, ...confirm }) },
  { name: 'inbox.discard', scope: 'update', description: 'Descarta entrada após confirmação reforçada do usuário.', schema: z.object({ id, ...confirm }) },
] as const

export function createAnotaMcpServer(identity: McpIdentity) {
  const server = new McpServer({ name: 'anota-ai', version: '0.1.0' })
  for (const definition of definitions) {
    server.registerTool(definition.name, {
      description: definition.description,
      inputSchema: definition.schema.shape,
      annotations: { readOnlyHint: definition.scope === 'read' },
    }, async (args: Record<string, unknown>) => {
      const requestId = identity.requestId ?? randomUUID()
      try {
        if (!identity.scopes.includes(definition.scope)) throw new Error('INSUFFICIENT_SCOPE')
        const prisma = getPrisma()
        const { result, rejected } = await prisma.$transaction(async (transaction) => {
          const value = await callMcpTool(definition.name, args as Record<string, unknown>, {
            ownerId: identity.ownerId, repository: transaction as never,
          })
          const rejected = isDomainFailure(value)
          await transaction.auditLog.create({ data: {
            actorId: identity.ownerId,
            action: `mcp.${definition.name}`,
            entityType: 'McpTool',
            entityId: typeof args.id === 'string' ? args.id : undefined,
            metadata: {
              tokenId: identity.tokenId, requestId, outcome: rejected ? 'rejected' : 'success',
              parameterFields: Object.keys(args),
              resultKind: value && typeof value === 'object' && 'kind' in value ? String(value.kind) : undefined,
              confirmed: (args as Record<string, unknown>).confirmed === true,
              confirmedSensitive: (args as Record<string, unknown>).confirmedSensitive === true,
            },
          } })
          return { result: value, rejected }
        })
        return { isError: rejected, content: [{ type: 'text' as const, text: JSON.stringify({ requestId, result }) }] }
      } catch (error) {
        const code = publicErrorCode(error)
        console.error(JSON.stringify({ event: 'mcp.tool_failed', requestId, tool: definition.name,
          ownerId: identity.ownerId, tokenId: identity.tokenId, error: serializeError(error),
        }))
        try {
          await getPrisma().auditLog.create({ data: { actorId: identity.ownerId, action: `mcp.${definition.name}.failed`,
            entityType: 'McpTool', metadata: { tokenId: identity.tokenId, requestId, outcome: 'error', code },
          } })
        } catch (auditError) {
          console.error(JSON.stringify({ event: 'mcp.audit_failed', requestId, tool: definition.name, error: serializeError(auditError) }))
        }
        return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify({ requestId, error: code }) }] }
      }
    })
  }
  return server
}

function publicErrorCode(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'INSUFFICIENT_SCOPE' || error.message === 'CONFIRMATION_REQUIRED') return error.message
    if (error.message.startsWith('INVALID_INPUT:') || error.name === 'ZodError') return 'INVALID_INPUT'
  }
  return 'MCP_TOOL_FAILED'
}

function isDomainFailure(value: unknown) {
  if (!value || typeof value !== 'object' || !('kind' in value)) return false
  return ['invalid', 'not-found', 'project-not-found', 'duplicate', 'too-large', 'not-ready'].includes(String(value.kind))
}

function serializeError(error: unknown) {
  if (!(error instanceof Error)) return { name: 'NonError', message: String(error) }
  return { name: error.name, message: error.message, stack: error.stack,
    cause: error.cause instanceof Error ? { name: error.cause.name, message: error.cause.message, stack: error.cause.stack } : error.cause,
  }
}
