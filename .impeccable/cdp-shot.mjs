import { writeFileSync } from 'node:fs'
const targets = await (await fetch('http://localhost:9224/json')).json()
const page = targets.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve) => { ws.onopen = resolve })
let id = 1
const send = (method, params) => new Promise((resolve) => {
  const mid = id++
  const handler = (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id === mid) { ws.removeEventListener('message', handler); resolve(msg) }
  }
  ws.addEventListener('message', handler)
  ws.send(JSON.stringify({ id: mid, method, params }))
})
const shot = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync('C:/Users/joao.neri/observa/anota ai/.impeccable/shots/cdp-mobile.png', Buffer.from(shot.result.data, 'base64'))
console.log('saved')
ws.close()
