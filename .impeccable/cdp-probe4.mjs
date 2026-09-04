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
const probe = await send('Runtime.evaluate', {
  expression: `(() => {
    const hits = [];
    for (const el of document.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.left < 90 && r.right > 10 && r.top < 850 && r.bottom > 780) {
        const cs = getComputedStyle(el);
        hits.push(el.tagName + ' {"' + String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className).slice(0, 50) + '"} pe=' + cs.pointerEvents + ' bg=' + cs.backgroundColor + ' pos=' + cs.position + ' rect=' + Math.round(r.left) + ',' + Math.round(r.top) + ',' + Math.round(r.width) + 'x' + Math.round(r.height));
      }
    }
    return hits.join('\\n');
  })()`,
  returnByValue: true,
})
console.log(probe.result.result.value || JSON.stringify(probe))
ws.close()
