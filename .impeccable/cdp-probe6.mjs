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
    const frames = [...document.querySelectorAll('iframe')].map((f) => {
      const r = f.getBoundingClientRect();
      return 'IFRAME src=' + f.src + ' r=' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' style=' + (f.getAttribute('style') || '');
    });
    const canv = [...document.querySelectorAll('canvas')].map((c) => {
      const r = c.getBoundingClientRect();
      return 'CANVAS ' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height);
    });
    return frames.concat(canv).join('\\n') || 'NONE';
  })()`,
  returnByValue: true,
})
console.log(probe.result.result.value)
ws.close()
