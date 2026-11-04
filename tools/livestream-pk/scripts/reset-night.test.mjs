import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resetNight } from './reset-night.mjs';

function makeDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reset-night-'));
  for (const f of ['state.json', 'backup-night-1.json', 'backup-night-2.json', 'settings.json', 'garden-state.json', 'khac.txt']) {
    fs.writeFileSync(path.join(dir, f), '{}');
  }
  fs.mkdirSync(path.join(dir, 'sub'));
  fs.writeFileSync(path.join(dir, 'sub', 'state.json'), '{}');
  return dir;
}

test('dry run lists the 4 matching files and deletes nothing', () => {
  const dir = makeDir();
  try {
    const { removed } = resetNight({ dir, apply: false });
    assert.deepEqual(removed, ['backup-night-1.json', 'backup-night-2.json', 'settings.json', 'state.json']);
    assert.equal(fs.readdirSync(dir).length, 7);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('apply deletes exactly those files and keeps garden data and others', () => {
  const dir = makeDir();
  try {
    const { removed } = resetNight({ dir, apply: true });
    assert.equal(removed.length, 4);
    assert.deepEqual(fs.readdirSync(dir).sort(), ['garden-state.json', 'khac.txt', 'sub']);
    assert.ok(fs.existsSync(path.join(dir, 'sub', 'state.json')));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('missing dir returns empty list', () => {
  const dir = path.join(os.tmpdir(), 'reset-night-missing-' + Date.now());
  assert.deepEqual(resetNight({ dir, apply: true }), { removed: [] });
});
