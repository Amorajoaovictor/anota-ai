import { requireCurrentUserId } from '../lib/auth/server'
import { toErrorResponse } from './http'

type OwnerHandler<Context> = (input: { ownerId: string; request: Request; context: Context }) => Promise<Response>

/**
 * Fica separado de `http.ts` porque puxa o SDK do Neon Auth: rotas sem sessão de usuário
 * (como a execução da fila) usam só o mapeamento de erros, sem carregar autenticação.
 */
export function withOwner<Context = unknown>(handler: OwnerHandler<Context>) {
  return async (request: Request, context: Context) => {
    try {
      const ownerId = await requireCurrentUserId()
      return await handler({ ownerId, request, context })
    } catch (error) {
      return toErrorResponse(error)
    }
  }
}
