import { createHash } from 'node:crypto'

/** Canonicalização definida pelo plano: UTF-8, LF e Unicode NFC. */
export function canonicalizeMarkdown(content: string): string {
  return content.replace(/\r\n?/g, '\n').normalize('NFC')
}

export function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

export function hashMarkdown(content: string): string {
  return sha256(canonicalizeMarkdown(content))
}
