const targets = await (await fetch('http://localhost:9224/json')).json()
const page = targets.find((t) => t.type === 'page')
if (!page) { console.log('NO PAGE'); process.exit(1) }
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
const expr = `JSON.stringify(document.elementsFromPoint(30, 760).map((e) => e.tagName + '#' + (e.id || '') + '.' + String(e.className).slice(0, 40) + ' | "' + (e.textContent || '').slice(0, 40).replace(/\\n/g, ' ')).slice(0, 8))`
const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true })
console.log(JSON.parse(r.result.result.value).join('\n'))
ws.close()
