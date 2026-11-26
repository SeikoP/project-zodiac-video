import assert from 'node:assert/strict';
import test from 'node:test';
import {createClient} from '../tools/studio_e2e/cdp.mjs';
import {runStep} from '../tools/studio_e2e/run_step.mjs';

// A fake CDP endpoint: records every command and answers from a script.
function fakeTransport(answer) {
  const sent = [];
  let listener = () => {};
  return {
    sent,
    send(text) {
      const message = JSON.parse(text);
      sent.push(message);
      queueMicrotask(() => listener(JSON.stringify({id: message.id, result: answer(message)})));
    },
    onMessage(callback) { listener = callback; },
    close() {},
  };
}

test('eval returns the page value by value', async () => {
  const transport = fakeTransport((m) => ({result: {value: {ok: 1}}}));
  const page = createClient(transport);
  assert.deepEqual(await page.eval('return {ok:1}'), {ok: 1});
  assert.equal(transport.sent[0].method, 'Runtime.evaluate');
  assert.equal(transport.sent[0].params.returnByValue, true);
  assert.equal(transport.sent[0].params.awaitPromise, true);
});

test('click sends move, press and release at the element centre', async () => {
  const transport = fakeTransport((m) => m.method === 'Runtime.evaluate' ? {result: {value: {x: 40, y: 60}}} : {});
  await createClient(transport).click('return document.body');
  const mouse = transport.sent.filter((m) => m.method === 'Input.dispatchMouseEvent');
  assert.deepEqual(mouse.map((m) => m.params.type), ['mouseMoved', 'mousePressed', 'mouseReleased']);
  assert.ok(mouse.every((m) => m.params.x === 40 && m.params.y === 60 && m.params.button === 'left'));
});

test('click rejects when the element is missing', async () => {
  const transport = fakeTransport(() => ({result: {value: null}}));
  await assert.rejects(createClient(transport).click('return null'), /element not found/);
});

test('shot writes the screenshot bytes', async () => {
  const written = [];
  const transport = fakeTransport(() => ({data: Buffer.from('png').toString('base64')}));
  await createClient(transport, {writeFile: (path, bytes) => written.push([path, bytes.toString()])}).shot('a.png');
  assert.deepEqual(written, [['a.png', 'png']]);
});

test('runStep waits for Xong and reports seconds and text', async () => {
  const texts = ['Giọng đọc / Đang chạy', 'Giọng đọc / Đang chạy', 'Giọng đọc / Xong'];
  const page = {click: async () => {}, eval: async () => texts.shift() ?? 'Giọng đọc / Xong'};
  const result = await runStep(page, 'Giọng đọc', {timeoutSec: 5, pollMs: 1, until: /Xong/});
  assert.match(result.text, /Xong/);
  assert.ok(result.seconds >= 0);
});

test('runStep times out when the row never matches', async () => {
  const page = {click: async () => {}, eval: async () => 'Giọng đọc / Đang chạy'};
  await assert.rejects(runStep(page, 'Giọng đọc', {timeoutSec: 0.05, pollMs: 5, until: /Xong/}), /timeout/);
});
