import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COPY } from './copy.mjs';

// the stream never asks for gifts; this scans everything a viewer could read
const BEGGING = /xin quà|tặng quà|gửi quà|ủng hộ|donate|send (a )?gift|thả quà/i;
const here = path.dirname(fileURLToPath(import.meta.url));
const publicGarden = path.join(here, '../public/garden');
const files = [...fs.readdirSync(here).filter(f => f.endsWith('.mjs') && !f.endsWith('.test.mjs')).map(f => path.join(here, f)),
  ...(fs.existsSync(publicGarden) ? fs.readdirSync(publicGarden).map(f => path.join(publicGarden, f)).filter(f => fs.statSync(f).isFile() && !path.basename(f).startsWith('control')) : [])];

test('no viewer-facing string asks for a gift', () => {
  const strings = JSON.stringify(COPY);
  assert.doesNotMatch(strings, BEGGING);
  for (const f of files) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), BEGGING, path.basename(f));
});

test('the how-to line only mentions comments', () => {
  assert.match(COPY.howTo, /“trồng”/);
});
