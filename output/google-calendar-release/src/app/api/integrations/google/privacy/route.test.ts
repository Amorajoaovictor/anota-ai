import { describe, expect, it } from 'vitest'
import { GET } from './route'
describe('página pública de privacidade Google', () => {
  it('permite verificação Google sem sessão e não carrega scripts externos', async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'")
    expect(await response.text()).not.toContain('<script')
  })
})
