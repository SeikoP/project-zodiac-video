import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startGardenServer } from './server.mjs';

async function boot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'garden-srv-'));
  const s = await startGardenServer({ port: 0, dir, tiktok: false, simulator: true, log: () => {} });
  return { s, base: `http://127.0.0.1:${s.port}` };
}
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('the page is served and a simulated viewer shows up in the first poll', async () => {
  const { s, base } = await boot();
  try {
    const page = await fetch(base + '/');
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Vườn Mây/);
    const control = await fetch(base + '/control');
    assert.equal(control.status, 200);
    assert.match(await control.text(), /Bàn điều khiển/);
    const r = await post(base + '/api/sim', { kind: 'chat', user: { userId: 'x', nickname: 'Xuân' }, comment: 'chào' });
    assert.equal(r.status, 200);
    const first = await (await fetch(base + '/poll')).json();
    const events = first.msgs.map(m => m.event);
    assert.ok(events.includes('meta') && events.includes('frame'));
    const frame = first.msgs.find(m => m.event === 'frame').data;
    const plots = Object.values(frame.parts.plots);
    assert.equal(plots.length, 1);
    assert.equal(plots[0].owner.nickname, 'Xuân');
  } finally { await s.close(); }
});

test('simulator can populate a room and start or stop autonomous players', async () => {
  const { s, base } = await boot();
  try {
    const added = await (await post(base + '/api/sim-room', { action: 'add', count: 6 })).json();
    assert.equal(added.result.added, 6);
    assert.deepEqual(added.result, { running: false, bots: 6, added: 6 });

    const started = await (await post(base + '/api/sim-room', { action: 'start' })).json();
    assert.deepEqual(started.result, { running: true, bots: 6 });
    const status = await (await fetch(base + '/api/status')).json();
    assert.deepEqual(status.autoplay, { running: true, bots: 6 });

    const stopped = await (await post(base + '/api/sim-room', { action: 'stop' })).json();
    assert.deepEqual(stopped.result, { running: false, bots: 6 });
  } finally { await s.close(); }
});

test('a simulated gift reaches the camera as a shot on the next poll', async () => {
  const { s, base } = await boot();
  try {
    await post(base + '/api/sim', { kind: 'chat', user: { userId: 'x', nickname: 'Xuân' }, comment: 'chào' });
    const first = await (await fetch(base + '/poll')).json();
    await post(base + '/api/sim', { kind: 'gift', user: { userId: 'x', nickname: 'Xuân' }, diamonds: 100, count: 1 });
    await new Promise(r => setTimeout(r, 400));
    const next = await (await fetch(`${base}/poll?id=${first.id}`)).json();
    const shot = next.msgs.find(m => m.event === 'shot')?.data;
    assert.equal(shot?.kind, 'gift');
  } finally { await s.close(); }
});

test('Garden runs the overlay, control and poll through one port', async () => {
  const { s, base } = await boot();
  try {
    assert.equal((await fetch(base + '/')).status, 200);
    assert.equal((await fetch(base + '/control')).status, 200);
    assert.equal((await fetch(base + '/poll')).status, 200);
    assert.equal(s.sharePort, undefined);
  } finally { await s.close(); }
});

test('the camera can be locked from the host panel', async () => {
  const { s, base } = await boot();
  try {
    await post(base + '/api/camera-lock', { on: true });
    assert.equal(s.camera.state().locked, true);
  } finally { await s.close(); }
});

test('static files cannot escape the public folder', async () => {
  const { s, base } = await boot();
  try {
    const r = await fetch(base + '/..%2f..%2fpackage.json');
    assert.notEqual(r.status, 200);
  } finally { await s.close(); }
});
