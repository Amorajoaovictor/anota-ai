import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { getPrisma } from '../../../../../lib/prisma'
import { exchangeGoogleToken, googleConfig, GOOGLE_SCOPE, sealToken } from '../../../../../server/google-calendar'
import { withMcpOwner } from '../../../../../server/mcp/with-owner'
import { ValidationError, readJsonBody } from '../../../../../server/http'
export const dynamic = 'force-dynamic'
export const POST = withMcpOwner(async ({ ownerId, request }) => {
  if (request.headers.get('origin') !== new URL(request.url).origin) throw new ValidationError('Origem OAuth inválida.')
  const parsed = z.object({ state: z.string().min(1).max(200), code: z.string().min(1).max(2000) }).strict().safeParse(await readJsonBody(request))
  if (!parsed.success) throw new ValidationError('Autorização Google não concluída.')
  const { state, code } = parsed.data
  const prisma = getPrisma()
  const consumed = await prisma.googleOAuthState.deleteMany({ where: { stateHash: createHash('sha256').update(state).digest('hex'), ownerId, expiresAt: { gt: new Date() } } })
  if (consumed.count !== 1) throw new ValidationError('Autorização Google expirada ou inválida. Conecte novamente.')
  const config = googleConfig()
  const token = await exchangeGoogleToken(config, { grant_type: 'authorization_code', code, redirect_uri: config.redirectUri })
  if (!token.scope?.split(' ').includes(GOOGLE_SCOPE)) throw new ValidationError('Permissão para eventos do Calendar não concedida.')
  if (!token.refresh_token) throw new ValidationError('Google não concedeu acesso offline. Conecte novamente.')
  const data = { refreshToken: sealToken(token.refresh_token, config.encryptionKey), scope: token.scope }
  await prisma.googleCalendarConnection.upsert({ where: { ownerId }, create: { ownerId, ...data }, update: data })
  await prisma.auditLog.create({ data: { actorId: ownerId, action: 'google.connected', entityType: 'GoogleCalendarConnection', entityId: ownerId } })
  return NextResponse.json({ connected: true })
})

// Google returns from another site. Render our origin before fetching session:
// Neon Auth deliberately uses SameSite=Strict. Do not weaken session cookies.
export async function GET(_request: Request) {
  const requestId = randomUUID()
  const nonce = randomBytes(16).toString('base64')
  return new Response(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Conectar Google — Anota Aí</title><body><main><h1>Conectando Google Calendar</h1><p id="status" role="status">Validando sua sessão no Anota Aí…</p><a href="/">Voltar ao Anota Aí</a></main><script nonce="${nonce}">
(async () => {
  const params = new URLSearchParams(location.search);
  const state = params.get('state');
  const code = params.get('code');
  history.replaceState(null, '', location.pathname);
  const status = document.getElementById('status');
  if (!state || !code || params.has('error')) { status.textContent = 'Autorização Google não concluída. Volte ao app e conecte novamente.'; return; }
  try {
    const response = await fetch(location.pathname, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state, code }) });
    const result = await response.json();
    if (!response.ok) { status.textContent = (response.status === 401 ? 'Sessão expirada. Entre no Anota Aí e conecte Google novamente.' : result.error || 'Não foi possível concluir conexão Google.') + ' Referência: ' + response.headers.get('x-request-id'); return; }
    location.replace('/?google=connected');
  } catch { status.textContent = 'Conexão interrompida. Volte ao Anota Aí e conecte Google novamente.'; }
})();
</script></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Request-Id': requestId, 'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'` } })
}
