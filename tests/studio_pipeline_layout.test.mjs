import test from 'node:test';
import assert from 'node:assert/strict';
import { groupByPhase, phaseSummary } from '../apps/zodiac-studio/src/pipeline/status.ts';
import { createPipelineStore } from '../apps/zodiac-studio/src/pipeline/pipeline-store.ts';

function nodes(sceneCount = 3) {
  const scenes = Array.from({ length: sceneCount }, (_, i) => `s${String(i + 1).padStart(2, '0')}`);
  const step = (id, inputs, kind = 'step', status = 'DONE', scene_id = null) => ({ id, title: id, kind, status, inputs, detail: '', scene_id });
  const fan = scenes.length ? scenes.map(s => step(`scene:${s}`, ['assets'], 'fan', 'DONE', s)) : [];
  const buildInputs = scenes.length ? scenes.map(s => `scene:${s}`) : ['assets'];
  return [step('content', [], 'gate'), step('voice', ['content']), step('voice_review', ['voice'], 'gate'), step('timing', ['voice_review']),
    step('visual', ['timing']), step('checks', ['visual']), step('assets', ['checks']), step('cover', ['checks']), step('publish', ['checks']),
    ...fan, step('build', buildInputs), step('inspect', ['build']), step('visual_review', ['inspect', 'cover', 'publish'], 'gate'),
    step('export', ['visual_review'])];
}


test('steps group into four phases in order and scenes stay in one compact list', () => {
  const groups = groupByPhase(nodes(3));
  assert.deepEqual(groups.map(g => g.phase.id), ['content', 'voice', 'visual', 'export']);
  const visual = groups.find(g => g.phase.id === 'visual');
  assert.equal(visual.scenes.length, 3);
  assert.ok(visual.steps.some(n => n.id === 'build') && visual.steps.some(n => n.id === 'visual_review'));
  assert.equal(groups.find(g => g.phase.id === 'voice').steps.map(n => n.id).join(), 'voice,voice_review,timing');
});

test('an unknown node never disappears from the list', () => {
  const extra = { id: 'brand_new', title: 'x', kind: 'step', status: 'READY', inputs: [], detail: '', scene_id: null };
  const all = groupByPhase([...nodes(1), extra]).flatMap(g => [...g.steps, ...g.scenes]);
  assert.ok(all.some(n => n.id === 'brand_new'));
});

test('summary counts finished steps', () => {
  const list = nodes(2); list[0].status = 'PENDING';
  assert.deepEqual(phaseSummary(list), { done: list.length - 1, total: list.length });
});

// ---- store ----
function fakeEnv({ hidden = false } = {}) {
  const timers = []; let nextId = 1; const listeners = new Set(); const state = { hidden };
  return {
    timers, state,
    timer: { set: (fn, ms) => { const id = nextId++; timers.push({ id, fn, ms, live: true }); return id; },
      clear: id => { const t = timers.find(x => x.id === id); if (t) t.live = false; } },
    visibility: { isHidden: () => state.hidden, subscribe: cb => { listeners.add(cb); return () => listeners.delete(cb); } },
    setHidden(value) { state.hidden = value; listeners.forEach(cb => cb()); },
    live: () => timers.filter(t => t.live),
  };
}
function data(over = {}) {
  return { format: 'zodiac-pipeline@1', project_id: 'p', revision: 5, revisions: { visual: 5, voice: 4 }, mode: 'confirm', run: null, nodes: nodes(2), ...over };
}
function fakeApi(sequence) {
  const calls = []; let i = 0;
  const next = () => Promise.resolve(structuredClone(sequence[Math.min(i++, sequence.length - 1)]));
  return { calls,
    get: p => { calls.push(['get', p]); return next(); },
    run: (p, n, r) => { calls.push(['run', p, n, r]); return next(); },
    cancel: p => { calls.push(['cancel', p]); return next(); },
    autopilotStart: (p, r) => { calls.push(['autopilotStart', p, r]); return Promise.resolve({ state: 'RUNNING' }); },
    autopilotStop: p => { calls.push(['autopilotStop', p]); return Promise.resolve({ state: 'STOPPED' }); },
    setMode: (p, m) => { calls.push(['setMode', p, m]); return Promise.resolve({ mode: m }); } };
}
const make = (api, env) => createPipelineStore(api, { projectId: 'p', timer: env.timer, visibility: env.visibility });

test('store keeps snapshot identity on equal payload', async () => {
  const env = fakeEnv(); const api = fakeApi([data()]); const store = make(api, env);
  await store.refresh(); const first = store.getSnapshot();
  let notified = 0; store.subscribe(() => { notified += 1; });
  await store.refresh();
  assert.equal(store.getSnapshot(), first);
  assert.equal(notified, 0);
  store.dispose();
});

test('store polls faster while running and stops when hidden', async () => {
  const env = fakeEnv(); const running = data(); running.nodes[1].status = 'RUNNING';
  const api = fakeApi([running, data()]); const store = make(api, env);
  await store.refresh();
  assert.equal(env.live().at(-1).ms, 1500);
  env.live().forEach(t => env.timer.clear(t.id));
  await store.refresh();
  assert.equal(env.live().at(-1).ms, 5000);
  env.setHidden(true);
  assert.equal(env.live().length, 0, 'hiding the window cancels the poll');
  await store.refresh();
  assert.equal(env.live().length, 0, 'no poll is scheduled while hidden');
  env.setHidden(false);
  assert.ok(env.live().length >= 1 || api.calls.length > 3, 'becoming visible resumes polling');
  store.dispose();
});

test('store.run rejects when node is gate and never calls the api', async () => {
  const env = fakeEnv(); const api = fakeApi([data()]); const store = make(api, env);
  await store.refresh();
  const before = api.calls.length;
  await assert.rejects(() => store.run('voice_review'), /PIPELINE_GATE_USER_ONLY/);
  await assert.rejects(() => store.run('visual_review'), /PIPELINE_GATE_USER_ONLY/);
  assert.equal(api.calls.length, before);
  await store.run('voice');
  assert.deepEqual(api.calls.filter(c => c[0] === 'run'), [['run', 'p', 'voice', 5]]);
  store.dispose();
});

test('snapshot exposes needsYou from run record', async () => {
  const env = fakeEnv();
  const run = { format: 'zodiac-pipeline-run@1', run_id: 'r1', state: 'WAITING_GATE', node: 'voice_review',
    needs_you: [{ node_id: 'voice_review', kind: 'gate', title: 'Cần bạn duyệt: voice_review', detail: '', issues: [] }], log: [] };
  const store = make(fakeApi([data({ run })]), env);
  await store.refresh();
  assert.equal(store.getSnapshot().needsYou.length, 1);
  assert.equal(store.getSnapshot().needsYou[0].kind, 'gate');
  assert.equal(store.getSnapshot().run.state, 'WAITING_GATE');
  assert.equal(store.getSnapshot().mode, 'confirm');
  store.dispose();
});

test('selection is only node and scene', async () => {
  const env = fakeEnv(); const store = make(fakeApi([data()]), env);
  await store.refresh();
  store.select('scene:s02');
  assert.deepEqual(store.getSnapshot().selection, { nodeId: 'scene:s02', sceneId: 's02' });
  store.select(null);
  assert.deepEqual(store.getSnapshot().selection, { nodeId: null, sceneId: null });
  store.select('does-not-exist');
  assert.deepEqual(store.getSnapshot().selection, { nodeId: null, sceneId: null });
  store.dispose();
});

test('autopilot and mode actions go through the api then refresh', async () => {
  const env = fakeEnv(); const api = fakeApi([data()]); const store = make(api, env);
  await store.refresh();
  await store.setMode('autopilot');
  await store.startAutopilot();
  await store.stopAutopilot();
  assert.deepEqual(api.calls.filter(c => c[0] !== 'get'), [['setMode', 'p', 'autopilot'], ['autopilotStart', 'p', 5], ['autopilotStop', 'p']]);
  assert.ok(api.calls.filter(c => c[0] === 'get').length >= 4);
  store.dispose();
});

test('a failed refresh keeps the last data and exposes the error', async () => {
  const env = fakeEnv(); let fail = false;
  const api = { ...fakeApi([data()]), get: () => (fail ? Promise.reject(new Error('RPC_FAILED')) : Promise.resolve(data())) };
  const store = make(api, env);
  await store.refresh(); fail = true; await store.refresh();
  assert.equal(store.getSnapshot().nodes.length, nodes(2).length);
  assert.match(store.getSnapshot().error, /RPC_FAILED/);
  store.dispose();
});

test('out-of-order responses never overwrite newer data', async () => {
  const env = fakeEnv(); const slow = data({ revision: 1 }); const fast = data({ revision: 2 });
  let resolveSlow; let call = 0;
  const api = { ...fakeApi([fast]), get: () => (call++ === 0 ? new Promise(r => { resolveSlow = () => r(slow); }) : Promise.resolve(fast)) };
  const store = make(api, env);
  const first = store.refresh(); const second = store.refresh();
  await second; resolveSlow(); await first;
  assert.equal(store.getSnapshot().revision, 2);
  store.dispose();
});

test('connect() is re-entrant: StrictMode disconnect then reconnect resumes polling and visibility handling', async () => {
  const env = fakeEnv(); const api = fakeApi([data()]); const store = make(api, env);
  const disconnect = store.connect(); disconnect(); // what React StrictMode does on purpose
  store.connect();
  await store.refresh();
  assert.equal(env.live().length, 1, 'polling is scheduled after reconnect');
  const calls = api.calls.length;
  env.setHidden(true); env.setHidden(false);
  await Promise.resolve();
  assert.ok(api.calls.length > calls, 'becoming visible refreshes after reconnect');
  store.dispose();
});


test('an older failed refresh cannot replace a newer successful refresh', async () => {
  const env = fakeEnv(); let rejectOld; let calls = 0;
  const api = { ...fakeApi([data()]), get: () => calls++ === 0 ? new Promise((_, reject) => { rejectOld = reject; }) : Promise.resolve(data({ revision: 9 })) };
  const store = make(api, env);
  const old = store.refresh(); await store.refresh(); rejectOld(new Error('old failure')); await old;
  assert.equal(store.getSnapshot().revision, 9);
  assert.equal(store.getSnapshot().error, null);
  store.dispose();
});

test('a disposed store ignores pending responses', async () => {
  const env = fakeEnv(); let finish;
  const api = { ...fakeApi([data()]), get: () => new Promise(resolve => { finish = resolve; }) };
  const store = make(api, env); const before = store.getSnapshot();
  const work = store.refresh(); store.dispose(); finish(data()); await work;
  assert.equal(store.getSnapshot(), before);
  assert.equal(env.live().length, 0);
});

// ---- compact visual phase (constructive pipeline) ----
import { phasePrimary, phaseProgress, cardView } from '../apps/zodiac-studio/src/pipeline/status.ts';

test('the visual phase offers one primary action: the first runnable step, never a gate or a scene', () => {
  const list = nodes(3);
  const set = (id, status) => { list.find(n => n.id === id).status = status; };
  assert.equal(phasePrimary(list.filter(n => groupByPhase(list).find(g => g.phase.id === 'visual').steps.includes(n))), null);
  set('visual', 'READY'); set('checks', 'READY'); set('scene:s01', 'READY'); set('visual_review', 'AWAITING_USER');
  const visual = groupByPhase(list).find(g => g.phase.id === 'visual');
  assert.equal(phasePrimary([...visual.steps, ...visual.scenes]).id, 'visual');
  set('visual', 'DONE');
  assert.equal(phasePrimary([...visual.steps, ...visual.scenes]).id, 'checks');
  set('checks', 'DONE');
  assert.notEqual(phasePrimary([...visual.steps, ...visual.scenes])?.kind, 'gate');
  assert.ok(!String(phasePrimary([...visual.steps, ...visual.scenes])?.id).startsWith('scene:'));
});

test('phase progress is one bar: done over total', () => {
  const list = nodes(2); list[4].status = 'RUNNING';
  const visual = groupByPhase(list).find(g => g.phase.id === 'visual');
  const all = [...visual.steps, ...visual.scenes];
  assert.deepEqual(phaseProgress(all), { done: all.length - 0 - all.filter(n => n.status !== 'DONE').length, total: all.length, percent: Math.round((all.filter(n => n.status === 'DONE').length / all.length) * 100) });
  assert.deepEqual(phaseProgress([]), { done: 0, total: 0, percent: 0 });
});

test('an owner card shows its three options with the default marked', () => {
  const view = cardView({ scene_id: 's02', reason: 'thiếu art', options: ['accept', 'restage', 'redo'], default: 'accept' });
  assert.deepEqual(view.options.map(o => o.id), ['accept', 'restage', 'redo']);
  assert.deepEqual(view.options.filter(o => o.isDefault).map(o => o.id), ['accept']);
  assert.ok(view.options.every(o => o.label && o.label !== o.id));
});

test('the store carries cards and the build id, and answering a card goes through the api then refreshes', async () => {
  const env = fakeEnv();
  const withCards = data({ cards: [{ scene_id: 's02', reason: 'x', options: ['accept', 'restage', 'redo'], default: 'accept' }], build_id: 'b1' });
  const api = fakeApi([withCards, data({ cards: [], build_id: 'b1' })]);
  const answered = [];
  api.resolveCard = (p, s, c) => { answered.push([p, s, c]); return Promise.resolve({}); };
  const store = createPipelineStore(api, { projectId: 'p', timer: env.timer, visibility: env.visibility });
  await store.refresh();
  assert.equal(store.getSnapshot().cards.length, 1);
  assert.equal(store.getSnapshot().buildId, 'b1');
  await store.resolveCard('s02', 'restage');
  assert.deepEqual(answered, [['p', 's02', 'restage']]);
  assert.equal(store.getSnapshot().cards.length, 0);
  store.dispose();
});

test('with no runnable step but runnable scenes, the store builds the scenes one after another', async () => {
  const env = fakeEnv();
  const list = nodes(3);
  const set = (id, status) => { list.find(n => n.id === id).status = status; };
  ['scene:s01', 'scene:s02', 'scene:s03'].forEach(id => set(id, 'READY'));
  const ran = [];
  const api = {
    get: () => Promise.resolve(structuredClone(data({ nodes: list }))),
    run: (p, id) => { ran.push(id); set(id, 'DONE'); return Promise.resolve(structuredClone(data({ nodes: list }))); },
    cancel: () => Promise.resolve(), autopilotStart: () => Promise.resolve({}), autopilotStop: () => Promise.resolve({}),
    setMode: () => Promise.resolve({ mode: 'confirm' }), resolveCard: () => Promise.resolve({}),
  };
  const store = createPipelineStore(api, { projectId: 'p', timer: env.timer, visibility: env.visibility });
  await store.refresh();
  assert.equal(await store.runScenes(), true);
  assert.deepEqual(ran, ['scene:s01', 'scene:s02', 'scene:s03']);
  store.dispose();
});

test('runScenes stops at the first scene that fails', async () => {
  const env = fakeEnv();
  const list = nodes(2); list.find(n => n.id === 'scene:s01').status = 'READY'; list.find(n => n.id === 'scene:s02').status = 'READY';
  const ran = [];
  const api = {
    get: () => Promise.resolve(structuredClone(data({ nodes: list }))),
    run: (p, id) => { ran.push(id); list.find(n => n.id === id).status = 'FAILED'; return Promise.resolve({}); },
    cancel: () => Promise.resolve(), autopilotStart: () => Promise.resolve({}), autopilotStop: () => Promise.resolve({}),
    setMode: () => Promise.resolve({ mode: 'confirm' }), resolveCard: () => Promise.resolve({}),
  };
  const store = createPipelineStore(api, { projectId: 'p', timer: env.timer, visibility: env.visibility });
  await store.refresh();
  assert.equal(await store.runScenes(), false);
  assert.deepEqual(ran, ['scene:s01']);
  store.dispose();
});
