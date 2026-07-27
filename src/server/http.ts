import { NextResponse } from 'next/server'

export class HttpError extends Error {
  constructor(readonly status: number, message: string, readonly issues?: string[]) {
    super(message)
    this.name = 'HttpError'
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Não autenticado.') {
    super(401, message)
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Recurso não encontrado.') {
    super(404, message)
  }
}

export class ValidationError extends HttpError {
  constructor(message = 'Dados inválidos.', issues?: string[]) {
    super(400, message, issues)
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Recurso já existe.') {
    super(409, message)
  }
}

export class PayloadTooLargeError extends HttpError {
  constructor(message = 'Arquivo acima do tamanho permitido.') {
    super(413, message)
  }
}

export function toErrorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json(
      error.issues ? { error: error.message, issues: error.issues } : { error: error.message },
      { status: error.status },
    )
  }
  return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
}

export async function readJsonBody(request: Request) {
  try {
    return await request.json()
  } catch {
    throw new ValidationError('Corpo da requisição não é JSON válido.')
  }
}
