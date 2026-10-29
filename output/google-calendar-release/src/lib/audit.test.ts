import { describe, expect, it } from 'vitest'
import { redactAuditMetadata } from './audit'

describe('auditoria', () => {
  it('remove credenciais da metadata antes de persistir o evento', () => {
    const result = redactAuditMetadata({
      title: 'Criar projeto',
      token: 'trello-secret',
      password: 'senha-secreta',
      nested: { authorization: 'Bearer secret', visible: 'ok' },
      DATABASE_URL: 'postgresql://user:pass@host/db',
    })

    expect(result).toEqual({
      title: 'Criar projeto',
      nested: { visible: 'ok' },
    })
  })
})
