// Minimal Chrome DevTools Protocol client for driving the real Zodiac Studio window (WebView2 on port 9227).
// Clicks are real mouse events, so this exercises the GUI the way a person does.
import {writeFile as fsWriteFile} from 'node:fs/promises';

/** transport: {send(text), onMessage(cb(text)), close()} — injectable so the client is testable without a browser. */
export function createClient(transport, {writeFile = fsWriteFile} = {}) {
  let id = 0;
  const pending = new Map();
  transport.onMessage((text) => {
    const message = JSON.parse(text);
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const callId = ++id;
    pending.set(callId, (message) => message.error ? reject(new Error(message.error.message)) : resolve(message.result));
    transport.send(JSON.stringify({id: callId, method, params}));
  });
  const evaluate = async (body) => {
    const result = await call('Runtime.evaluate', {expression: `(async()=>{${body}})()`, awaitPromise: true, returnByValue: true});
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result?.value;
  };
  return {
    eval: evaluate,
    /** elementExpr is a function body returning the element to click. */
    async click(elementExpr) {
      const point = await evaluate(`const el=(()=>{${elementExpr}})(); if(!el) return null; el.scrollIntoView({block:'center'}); const b=el.getBoundingClientRect(); return {x:b.x+b.width/2,y:b.y+b.height/2};`);
      if (!point) throw new Error('element not found');
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
        await call('Input.dispatchMouseEvent', {type, x: point.x, y: point.y, button: 'left', clickCount: 1});
      }
    },
    async shot(path) {
      const {data} = await call('Page.captureScreenshot', {format: 'png'});
      await writeFile(path, Buffer.from(data, 'base64'));
    },
    close: () => transport.close(),
  };
}

export async function connect({port = 9227, urlIncludes = '1420'} = {}) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = targets.find((t) => t.url.includes(urlIncludes));
  if (!target) throw new Error(`No Studio page on port ${port}; start the app with WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=${port}`);
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let listener = () => {};
  socket.onmessage = (event) => listener(event.data);
  return createClient({send: (text) => socket.send(text), onMessage: (cb) => { listener = cb; }, close: () => socket.close()});
}
