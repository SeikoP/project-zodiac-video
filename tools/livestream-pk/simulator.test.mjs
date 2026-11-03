import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePorts() {
  const servers = [net.createServer(), net.createServer()];
  await Promise.all(servers.map(server => new Promise((resolve, reject) => {
    server.once('error', reject).listen(0, '127.0.0.1', resolve);
  })));
  const ports = servers.map(server => server.address().port);
  await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))));
  return ports;
}
async function post(port, route, body = {}) {
  const response = await fetch(`http://127.0.0.1:${port}/api/${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

test('simulator browser and server entrypoints have valid JavaScript syntax', () => {
  for (const file of ['server.mjs', 'scripts/simulator.mjs', 'public/simulator/simulator.js']) {
    const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${file}: ${result.stderr || result.stdout}`);
  }
});

test('isolated LIVE simulator serves its UI and refuses real TikTok connections', { timeout: 20000 }, async () => {
  const [port, sharePort] = await freePorts();
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-simulator-test-'));
  const env = {
    ...process.env,
    PK_PORT: String(port),
    PK_SHARE_PORT: String(sharePort),
    PK_DATA_DIR: path.join(work, 'data'),
    PK_LOG_DIR: path.join(work, 'logs'),
    PK_NO_TIKTOK: '1',
    PK_SIMULATOR: '1',
    PK_FRAME_MS: '100',
  };
  const child = spawn(process.execPath, ['server.mjs'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const exited = once(child, 'exit');

  try {
    let ready = false;
    for (let i = 0; i < 80; i++) {
      if (child.exitCode !== null) break;
      try {
        const response = await fetch(`http://127.0.0.1:${port}/simulator`);
        if (response.status === 200) { ready = true; break; }
      } catch { /* server is still starting */ }
      await pause(100);
    }
    assert.equal(ready, true, `Simulator did not start. Server output: ${output}`);

    const page = await fetch(`http://127.0.0.1:${port}/simulator`);
    assert.match(await page.text(), /TikTok LIVE Simulator/);
    assert.equal((await fetch(`http://127.0.0.1:${port}/simulator/simulator.js`)).status, 200);
    assert.equal((await fetch(`http://127.0.0.1:${port}/simulator/simulator.css`)).status, 200);

    const denied = await post(port, 'tiktok/connect', { username: 'must-not-connect' });
    assert.equal(denied.status, 500);
    assert.match(denied.body.error, /disabled in the isolated simulator/);

    const eventAbort = new AbortController();
    const eventResponse = await fetch(`http://127.0.0.1:${port}/events`, { signal: eventAbort.signal });
    assert.equal(eventResponse.status, 200);
    const reader = eventResponse.body.getReader();
    const decoder = new TextDecoder();
    let eventBuffer = '';
    const nextSimulatorEvent = async () => {
      for (;;) {
        const boundary = eventBuffer.indexOf('\n\n');
        if (boundary >= 0) {
          const block = eventBuffer.slice(0, boundary);
          eventBuffer = eventBuffer.slice(boundary + 2);
          if (block.startsWith('event: sim-event\n')) {
            const data = block.split('\n').find(line => line.startsWith('data: '));
            if (data) return JSON.parse(data.slice(6));
          }
          continue;
        }
        const { done, value } = await reader.read();
        if (done) throw new Error('Simulator event stream closed unexpectedly');
        eventBuffer += decoder.decode(value, { stream: true });
      }
    };

    const joinEvent = nextSimulatorEvent();
    assert.equal((await post(port, 'sim/member', { user: 'Lan' })).body.ok, true);
    const joined = await Promise.race([joinEvent, pause(3000).then(() => { throw new Error('Missing simulated join event'); })]);
    assert.equal(joined.kind, 'member');
    assert.equal(joined.user.nickname, 'Lan');

    const chatEvent = nextSimulatorEvent();
    assert.equal((await post(port, 'sim/chat', { user: 'Lan', comment: 'sư tử' })).body.ok, true);
    const chatted = await Promise.race([chatEvent, pause(3000).then(() => { throw new Error('Missing simulated chat event'); })]);
    assert.equal(chatted.kind, 'chat');
    assert.equal(chatted.comment, 'sư tử');

    assert.equal((await post(port, 'sim/crowd', { count: 100, giftRate: 0 })).body.ok, true);
    eventAbort.abort();

    const sharedSimulator = await fetch(`http://127.0.0.1:${sharePort}/simulator`);
    assert.equal(sharedSimulator.status, 404, 'the read-only public overlay route must not expose the simulator');
  } finally {
    child.kill('SIGTERM');
    await Promise.race([exited, pause(1500)]);
    if (child.exitCode === null) child.kill('SIGKILL');
    await Promise.race([exited, pause(1500)]);
    fs.rmSync(work, { recursive: true, force: true });
  }
});
