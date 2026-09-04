const targets = await (await fetch('http://localhost:9224/json')).json()
const page = targets.find((t) => t.type === 'page')
if (!page) { console.log('NO PAGE'); process.exit(1) }
console.log('PAGE URL:', page.url)
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
const probe = await send('Runtime.evaluate', {
  expression: `(() => {
    const out = [];
    for (const [x, y] of [[30, 760], [28, 758], [35, 762]]) {
      const els = document.elementsFromPoint(x, y).map((e) => e.tagName + '.' + String(e.className).slice(0, 40));
      out.push(x + ',' + y + ' :: ' + els.join(' > '));
    }
    return out.join('\\n');
  })()`,
  returnByValue: true,
})
console.log('RAW:', JSON.stringify(probe.result))
ws.close()
