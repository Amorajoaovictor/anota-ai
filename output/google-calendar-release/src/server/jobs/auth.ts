import { timingSafeEqual } from 'node:crypto'

export function isValidRunnerToken(expected: string | null, received: string | null) {
  if (!expected || !received) return false
  const expectedBytes = Buffer.from(expected, 'utf8')
  const receivedBytes = Buffer.from(received, 'utf8')
  if (expectedBytes.length !== receivedBytes.length) return false
  return timingSafeEqual(expectedBytes, receivedBytes)
}
