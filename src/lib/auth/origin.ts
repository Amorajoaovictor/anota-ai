/**
 * O handler do Neon Auth monta o `Origin` do upstream a partir do header que chega
 * (`origin`, depois `referer`, depois a URL da requisição). Num deploy Vercel esse valor é o
 * domínio publicado, que a instância do Neon Auth não conhece e responde `INVALID_ORIGIN`.
 *
 * O navegador só fala com `/api/auth`; quem chama o Neon é este servidor. Então a requisição
 * sai daqui com a origem do próprio backend — confiável por definição — e a fronteira
 * anti-CSRF fica onde ela existe de fato: no nosso host (ver `isSameHostRequest`).
 */

/** Host por onde o navegador chegou; `x-forwarded-host` cobre proxy reverso na frente do Next. */
export function requestHost(request: Request) {
  return request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || new URL(request.url).host
}

/**
 * Requisição sem `Origin` (curl, servidor, navegação) passa; com `Origin` de outro host, não.
 * Isso preserva a proteção que o check de origem do Neon fazia antes de passarmos a origem dele.
 */
export function isSameHostRequest(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).host === requestHost(request)
  } catch {
    return false
  }
}

export function withUpstreamOrigin(headers: Headers, upstreamOrigin: string) {
  const forwarded = new Headers(headers)
  forwarded.set('origin', upstreamOrigin)
  return forwarded
}
