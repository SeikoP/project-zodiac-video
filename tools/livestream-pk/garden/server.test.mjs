import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startGardenServer } from './server.mjs';

async function boot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'garden-srv-'));
  const s = await startGardenServer({ port: 0, sharePort: 0, dir, tiktok: false, log: () => {} });
  return { s, base: `http://127.0.0.1:${s.port}`, share: `http://127.0.0.1:${s.sharePort}` };
}
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('the page is served and a simulated viewer shows up in the first poll', async () => {
  const { s, base } = await boot();
  try {
    const page = await fetch(base + '/');
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Vườn Mây/);
    const r = await post(base + '/api/sim', { kind: 'chat', user: { userId: 'x', nickname: 'Xuân' }, comment: 'Sư Tử' });
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

test('a simulated gift reaches the camera as a shot on the next poll', async () => {
  const { s, base } = await boot();
  try {
    await post(base + '/api/sim', { kind: 'chat', user: { userId: 'x', nickname: 'Xuân' }, comment: 'Sư Tử' });
    const first = await (await fetch(base + '/poll')).json();
    await post(base + '/api/sim', { kind: 'gift', user: { userId: 'x', nickname: 'Xuân' }, diamonds: 100, count: 1 });
    await new Promise(r => setTimeout(r, 400));
    const next = await (await fetch(`${base}/poll?id=${first.id}`)).json();
    const shot = next.msgs.find(m => m.event === 'shot')?.data;
    assert.equal(shot?.kind, 'gift');
  } finally { await s.close(); }
});

test('the share port is read-only: no API, no POST, but the overlay and poll work', async () => {
  const { s, share } = await boot();
  try {
    assert.equal((await fetch(share + '/')).status, 200);
    assert.equal((await post(share + '/api/sim', { kind: 'chat' })).status, 405);
    assert.equal((await fetch(share + '/api/sim')).status, 404);
    assert.equal((await fetch(share + '/poll')).status, 200);
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
