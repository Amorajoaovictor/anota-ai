import { spawn } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('MCP stdio', () => {
  it('não escreve diagnósticos no canal JSON-RPC quando falta token', async () => {
    const result = await new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve) => {
      const child = spawn(process.execPath, ['--import', 'tsx', 'src/server/mcp/stdio.ts'], {
        cwd: process.cwd(), env: { ...process.env, ANOTA_MCP_TOKEN: '' },
      })
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
      child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
      child.on('close', (code) => resolve({ stdout, stderr, code }))
    })
    expect(result.code).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('mcp.stdio_start_failed')
  })
})
