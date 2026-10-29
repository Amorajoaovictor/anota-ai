import { describe, expect, it } from 'vitest'
import {
  ConflictError,
  NotFoundError,
  PayloadTooLargeError,
  UnauthorizedError,
  ValidationError,
  readJsonBody,
  toErrorResponse,
} from './http'

describe('camada HTTP', () => {
  it('traduz cada erro de domínio para o status correspondente', () => {
    const cases: [Error, number][] = [
      [new UnauthorizedError(), 401],
      [new ValidationError(), 400],
      [new NotFoundError(), 404],
      [new ConflictError(), 409],
      [new PayloadTooLargeError(), 413],
    ]

    for (const [error, status] of cases) {
      expect(toErrorResponse(error).status).toBe(status)
    }
  })

  it('não vaza mensagem de erro inesperado', async () => {
    const response = toErrorResponse(new Error('conexão com o banco falhou em 10.0.0.4'))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Erro interno.' })
  })

  it('inclui issues de validação na resposta', async () => {
    const response = toErrorResponse(new ValidationError('Dados inválidos.', ['Nome é obrigatório.']))

    await expect(response.json()).resolves.toEqual({ error: 'Dados inválidos.', issues: ['Nome é obrigatório.'] })
  })

  it('responde 400 quando o corpo não é JSON válido', async () => {
    const request = new Request('http://localhost/api/projects', { method: 'POST', body: '{' })

    await expect(readJsonBody(request)).rejects.toBeInstanceOf(ValidationError)
  })
})
