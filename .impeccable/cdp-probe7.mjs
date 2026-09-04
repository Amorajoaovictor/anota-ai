const targets = await (await fetch('http://localhost:9225/json')).json()
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
// Dimensions of the visible viewport + hit test at the N position (approx from the CLI screenshot)
const metrics = await send('Page.getLayoutMetrics', {})
console.log('METRICS', JSON.stringify(metrics.result))
const hits = await send('Runtime.evaluate', {
  expression: `(() => {
    const out = [];
    for (const y of [755, 760, 765, 770]) {
      for (const x of [15, 20, 25, 30, 35, 40]) {
        const el = document.elementFromPoint(x, y);
        const r = el ? el.getBoundingClientRect() : null;
        out.push('pt ' + x + ',' + y + ' -> ' + (el ? el.tagName + '.' + String(el.className).slice(0, 30) + ' rect=' + Math.round(r.left) + ',' + Math.round(r.top) + ',' + Math.round(r.width) + 'x' + Math.round(r.height) : 'NONE'));
      }
    }
    return out.join('\\n');
  })()`,
  returnByValue: true,
})
console.log(hits.result.result.value)
ws.close()
