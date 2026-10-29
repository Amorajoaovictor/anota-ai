const sensitiveKey = /password|token|secret|authorization|cookie|database[_-]?url|connectionstring|api[_-]?key/i

type AuditValue = string | number | boolean | null | AuditMetadata | AuditValue[]
export type AuditMetadata = { [key: string]: AuditValue | undefined }

export function redactAuditMetadata(metadata: AuditMetadata): AuditMetadata {
  const redacted: AuditMetadata = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || sensitiveKey.test(key)) continue
    redacted[key] = Array.isArray(value) ? value.map(redactValue) : redactValue(value)
  }
  return redacted
}

function redactValue(value: AuditValue): AuditValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  return redactAuditMetadata(value)
}
