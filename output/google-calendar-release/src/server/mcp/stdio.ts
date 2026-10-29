import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { getPrisma } from '../../lib/prisma'
import { createAnotaMcpServer } from './server'
import { verifyMcpToken } from './tokens'

async function main() {
  const token = process.env.ANOTA_MCP_TOKEN
  if (!token) throw new Error('ANOTA_MCP_TOKEN não configurado para o transporte stdio.')
  const identity = await verifyMcpToken(getPrisma(), token)
  if (!identity) throw new Error('ANOTA_MCP_TOKEN inválido, expirado ou revogado.')
  serveStdio(() => createAnotaMcpServer(identity))
}

main().catch((error) => {
  console.error(JSON.stringify({ event: 'mcp.stdio_start_failed',
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
  }))
  process.exitCode = 1
})
