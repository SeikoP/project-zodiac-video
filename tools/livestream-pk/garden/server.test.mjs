import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startGardenServer } from './server.mjs';

async function boot(over = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'garden-srv-'));
  const s = await startGardenServer({ port: 0, dir, tiktok: false, simulator: true, log: () => {}, ...over });
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

test('simulator sets room size and realism profile instead of accumulating bots', async () => {
  const { s, base } = await boot();
  try {
    const set6 = await (await post(base + '/api/sim-room', { action:'set', count:6, profile:'normal' })).json();
    assert.deepEqual(set6.result, { running:false, bots:6, profile:'normal', target:6 });

    const set3 = await (await post(base + '/api/sim-room', { action:'set', count:3, profile:'busy' })).json();
    assert.deepEqual(set3.result, { running:false, bots:3, profile:'busy', target:3 });

    const started = await (await post(base + '/api/sim-room', { action:'start', profile:'busy' })).json();
    assert.deepEqual(started.result, { running:true, bots:3, profile:'busy', target:3 });
    const status = await (await fetch(base + '/api/status')).json();
    assert.deepEqual(status.autoplay, { running:true, bots:3, profile:'busy', target:3 });

    const stopped = await (await post(base + '/api/sim-room', { action:'stop' })).json();
    assert.deepEqual(stopped.result, { running:false, bots:3, profile:'busy', target:3 });
  } finally { await s.close(); }
});

test('a simulated gift is queued behind the current camera shot instead of interrupting it', async () => {
  const { s, base } = await boot();
  try {
    await post(base + '/api/sim', { kind: 'chat', user: { userId: 'x', nickname: 'Xuân' }, comment: 'chào' });
    await new Promise(r => setTimeout(r, 220));
    await post(base + '/api/sim', { kind: 'gift', user: { userId: 'x', nickname: 'Xuân' }, diamonds: 100, count: 1 });
    const status = await (await fetch(base + '/api/status')).json();
    assert.ok(status.camera.pending >= 1, 'gift waits instead of cutting the welcome shot');
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
