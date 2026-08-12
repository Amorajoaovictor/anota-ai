/**
 * Cliente HTTP das telas. Lê o formato de erro de `src/server/http.ts`
 * (`{ error, issues }`) e o transforma em mensagem pronta para o toast.
 */
export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly issues: string[] = []) {
    super(message)
    this.name = 'ApiError'
  }

  /** Mensagem única: o primeiro problema de validação é mais útil que o texto genérico. */
  get detail() {
    return this.issues[0] ?? this.message
  }
}

async function send<Result>(url: string, init: RequestInit): Promise<Result> {
  let response: Response
  try {
    response = await fetch(url, { credentials: 'same-origin', ...init })
  } catch {
    throw new ApiError(0, 'Sem conexão com o servidor.')
  }

  const payload = await response.json().catch(() => null) as
    | (Result & { error?: string; issues?: string[] })
    | null

  if (!response.ok) {
    throw new ApiError(response.status, payload?.error ?? 'Não foi possível concluir a operação.', payload?.issues ?? [])
  }
  return payload as Result
}

export function getJson<Result>(url: string) {
  return send<Result>(url, { method: 'GET' })
}

export function postJson<Result>(url: string, body: unknown) {
  return send<Result>(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function putJson<Result>(url: string, body: unknown) {
  return send<Result>(url, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Sem header de content-type: o browser define o boundary do multipart sozinho. */
export function postForm<Result>(url: string, form: FormData) {
  return send<Result>(url, { method: 'POST', body: form })
}

export function patchJson<Result>(url: string, body: unknown) {
  return send<Result>(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function deleteJson<Result>(url: string) {
  return send<Result>(url, { method: 'DELETE' })
}
