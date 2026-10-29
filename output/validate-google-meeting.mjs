import { writeFile } from 'node:fs/promises'
let sequence = 0
async function call(name, args) {
  const response = await fetch('https://anota-ai-orcin.vercel.app/api/mcp', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.ANOTA_MCP_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-11-25', 'mcp-method': 'tools/call' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++sequence, method: 'tools/call', params: { name, arguments: args, _meta: {} } }),
  })
  const raw = await response.text()
  const line = raw.split('\n').find((value) => value.startsWith('data: '))
  const protocol = JSON.parse(line ? line.slice(6) : raw)
  if (!response.ok || protocol.error) throw new Error(`MCP ${name}: HTTP ${response.status}; requestId=${response.headers.get('x-request-id')}; code=${protocol.error?.code}`)
  const output = JSON.parse(protocol.result.content.find((item) => item.type === 'text').text)
  if (protocol.result.isError) throw new Error(`MCP ${name}: requestId=${output.requestId}; code=${output.error ?? output.result?.reason ?? output.result?.kind}`)
  return output
}
const input = { title: 'Teste integração Anota Aí', description: 'Validação autorizada da integração Google Calendar e Meet. Sem convidados.', startsAt: '2026-10-15T09:00:00-03:00', endsAt: '2026-10-15T09:15:00-03:00', timezone: 'America/Fortaleza' }
const listed = await call('meetings.list', {})
let meeting = listed.result.meetings.find((item) => item.title === input.title && new Date(item.startsAt).getTime() === new Date(input.startsAt).getTime())
if (!meeting) {
  const created = await call('meetings.create', { meeting: input, confirmed: true })
  if (created.result.kind !== 'created') throw new Error(`Meeting creation rejected: ${created.result.kind}`)
  meeting = created.result.meeting
}
const scheduled = await call('meetings.schedule', { id: meeting.id, confirmed: true })
const proof = { requestId: scheduled.requestId, kind: scheduled.result.kind, conferenceStatus: scheduled.result.conferenceStatus, meetingId: meeting.id, title: input.title, startsAt: scheduled.result.meeting.startsAt, endsAt: scheduled.result.meeting.endsAt, link: scheduled.result.meeting.link, googleEventId: scheduled.result.meeting.googleEventId }
await writeFile('output/google-meeting-proof.json', JSON.stringify(proof, null, 2))
console.log(JSON.stringify(proof))
