import assert from 'node:assert/strict';
import test from 'node:test';
import {studioArgs} from '../scripts/open-studio.mjs';

test('Job5 studio uses pinned renderer entry and measured props, not a mock', () => {
  assert.deepEqual(studioArgs('src/index.ts', '/workspace/.runtime/renderer-v2-props.json'),
    ['studio', 'src/index.ts', '--props=/workspace/.runtime/renderer-v2-props.json']);
});
