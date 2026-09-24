import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'

export const mcpScopes = ['read', 'create', 'update', 'context'] as const
export const mcpTokenInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.enum(mcpScopes)).min(1).max(mcpScopes.length).refine((scopes) => new Set(scopes).size === scopes.length),
}).strict()

type TokenRecord = {
  id: string
  ownerId: string
  scopes: string[]
  expiresAt: Date
  revokedAt: Date | null
}

type McpTokenRepository = {
  mcpToken: {
    create(args: any): Promise<{ id: string; name: string; scopes: string[]; expiresAt: Date }>
    findUnique(args: any): Promise<TokenRecord | null>
    updateMany(args: any): Promise<{ count: number }>
  }
}

export async function createMcpToken(repository: McpTokenRepository, ownerId: string, input: unknown) {
  const { name, scopes } = mcpTokenInputSchema.parse(input)
  const token = `anota_mcp_${randomBytes(32).toString('hex')}`
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  const record = await repository.mcpToken.create({
    data: { ownerId, name, scopes, tokenHash: hashToken(token), expiresAt },
    select: { id: true, name: true, scopes: true, expiresAt: true },
  })
  return { token, record }
}

export async function verifyMcpToken(repository: McpTokenRepository, token: string) {
  if (!/^anota_mcp_[a-f0-9]{64}$/.test(token)) return null
  const record = await repository.mcpToken.findUnique({ where: { tokenHash: hashToken(token) } })
  if (!record || record.revokedAt || record.expiresAt <= new Date()) return null
  return { ownerId: record.ownerId, tokenId: record.id, scopes: record.scopes }
}

export async function revokeMcpToken(repository: McpTokenRepository, ownerId: string, tokenId: string) {
  const result = await repository.mcpToken.updateMany({
    where: { id: tokenId, ownerId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return result.count > 0
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}
