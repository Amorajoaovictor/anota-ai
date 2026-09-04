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
    const out = [];
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.position === 'absolute' || cs.zIndex !== 'auto') {
        const r = el.getBoundingClientRect();
        out.push('POS ' + el.tagName + '.' + String(el.className).slice(0, 30) + ' ' + cs.position + ' z=' + cs.zIndex + ' r=' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
      }
      const before = getComputedStyle(el, '::before').content;
      const after = getComputedStyle(el, '::after').content;
      if ((before && before !== 'none') || (after && after !== 'none')) {
        const r = el.getBoundingClientRect();
        out.push('PSEUDO ' + el.tagName + '.' + String(el.className).slice(0, 30) + ' b=' + String(before).slice(0, 24) + ' a=' + String(after).slice(0, 24) + ' r=' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
      }
    }
    return out.join('\\n');
  })()`,
  returnByValue: true,
})
console.log(probe.result.result.value || 'EMPTY')
ws.close()
