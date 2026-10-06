#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const [productionPath, planPath] = process.argv.slice(2);
if (!productionPath || !planPath) {
  console.error('Usage: node validate-interactions.mjs <production.json> <interaction-plan.json>');
  process.exit(2);
}
const production = JSON.parse(await readFile(productionPath, 'utf8'));
const plan = JSON.parse(await readFile(planPath, 'utf8'));
const root = path.dirname(fileURLToPath(import.meta.url));
const interactionMap = JSON.parse(await readFile(path.join(root, 'interaction-map.json'), 'utf8'));
const validTypes = new Set(['handoff','offer_take','shared_focus','approach','avoid','comfort','confront','follow','interrupt','reveal_catch','sit_together','cooperate']);
const validResolutions = new Set(['completed','interrupted','avoided','unresolved']);
const knownSlots = new Set(Object.values(interactionMap.scene_slots ?? {}).flatMap((slots) => Object.keys(slots)));
const profileByMaster = new Map();
for (const profile of Object.values(interactionMap.character_profiles ?? {})) for (const master of profile.applies_to ?? []) profileByMaster.set(master, profile);
const fail = (msg) => { throw new Error('INTERACTION_CHOREOGRAPHY: ' + msg); };
const relationalAction = /look|gaze|show|give|take|offer|reach|hold|release|approach|move|step|turn|react|comfort|touch|pull|push|follow|avoid|confront|interrupt|reveal|catch|sit|leave|enter|notice|share|block|freeze/iu;

if (plan.version !== '1.0' || !Array.isArray(plan.scenes)) fail('interaction plan must use version 1.0 and scenes[].');
const sceneById = new Map(production.scenes.map((scene) => [scene.id, scene]));
const interactionIds = new Set();
for (const scenePlan of plan.scenes) {
  const scene = sceneById.get(scenePlan.scene_id);
  if (!scene) fail('unknown scene ' + scenePlan.scene_id);
  const entityIds = new Set(scene.entities.map((entity) => entity.id));
  const eventIndex = new Map(scene.events.map((event, index) => [event.id, index]));
  const eventById = new Map(scene.events.map((event) => [event.id, event]));
  for (const interaction of scenePlan.interactions ?? []) {
    if (!interaction.id || interactionIds.has(interaction.id)) fail('interaction IDs must be unique: ' + interaction.id);
    if (!validTypes.has(interaction.type)) fail(interaction.id + ' has unsupported interaction type');
    if (!validResolutions.has(interaction.resolution)) fail(interaction.id + ' has invalid resolution');
    if (interaction.scene_slot && !knownSlots.has(interaction.scene_slot)) fail(interaction.id + ' references unknown scene_slot ' + interaction.scene_slot);
    interactionIds.add(interaction.id);
    if (!Array.isArray(interaction.participants) || interaction.participants.length < 2) fail(interaction.id + ' needs at least two participants');
    for (const id of interaction.participants) if (!entityIds.has(id)) fail(interaction.id + ' references missing participant ' + id);
    if (!interaction.participants.includes(interaction.initiator)) fail(interaction.id + ' initiator must be a participant');
    if (!Array.isArray(interaction.responders) || !interaction.responders.length) fail(interaction.id + ' needs responder(s)');
    for (const id of interaction.responders) if (!interaction.participants.includes(id)) fail(interaction.id + ' responder must be a participant: ' + id);
    if (!Array.isArray(interaction.event_ids) || interaction.event_ids.length < 2) fail(interaction.id + ' needs at least two ordered events');
    const indexes = interaction.event_ids.map((id) => {
      if (!eventIndex.has(id)) fail(interaction.id + ' references missing event ' + id);
      return eventIndex.get(id);
    });
    for (let i=1;i<indexes.length;i++) if (indexes[i] <= indexes[i-1]) fail(interaction.id + ' event_ids must follow production event order');
    const events = interaction.event_ids.map((id) => eventById.get(id));
    const changedTargets = new Set(events.filter((e) => e.target !== 'camera' && e.state_before !== e.state_after).map((e) => e.target));
    const participantChanges = interaction.participants.filter((id) => changedTargets.has(id));
    if (participantChanges.length < 2 && !(interaction.shared_prop && participantChanges.length >= 1 && changedTargets.has(interaction.shared_prop))) {
      fail(interaction.id + ' must visibly change at least two participants, or one participant plus the shared prop');
    }
    if (!events.some((e) => relationalAction.test(e.action))) fail(interaction.id + ' has no relational action');
    const initiatorIndexes = events.map((e,i) => e.target === interaction.initiator ? i : -1).filter((i) => i >= 0);
    if (!initiatorIndexes.length) fail(interaction.id + ' initiator must receive an event');
    const initiatorLast = Math.max(...initiatorIndexes);
    for (const responder of interaction.responders) {
      const responderAfter = events.findIndex((e,i) => i > initiatorLast && e.target === responder);
      if (responderAfter < 0) fail(interaction.id + ' responder ' + responder + ' needs a response after initiator activity');
    }
    if (['handoff','offer_take'].includes(interaction.type)) {
      if (!interaction.shared_prop || !entityIds.has(interaction.shared_prop)) fail(interaction.id + ' handoff needs an existing shared_prop');
      if (!interaction.ownership?.before || !interaction.ownership?.after || interaction.ownership.before === interaction.ownership.after) fail(interaction.id + ' handoff needs ownership.before != ownership.after');
      if (!interaction.participants.includes(interaction.ownership.before) || !interaction.participants.includes(interaction.ownership.after)) fail(interaction.id + ' ownership endpoints must be participants');
      if (!events.some((e) => e.target === interaction.shared_prop)) fail(interaction.id + ' shared prop must receive an event during transfer');
      if (!events.some((e) => e.target === interaction.ownership.before) || !events.some((e) => e.target === interaction.ownership.after)) fail(interaction.id + ' both old and new owners must participate in transfer events');
    }
    if (interaction.type === 'shared_focus') {
      const attentionEvents = events.filter((e) => /look|gaze|turn|notice|show|reveal|screen/iu.test(e.action));
      if (attentionEvents.length < 2) fail(interaction.id + ' shared_focus needs at least two attention/reveal events');
      const attentionTargets = new Set(attentionEvents.map((e) => e.target));
      for (const participant of interaction.participants) if (!attentionTargets.has(participant)) fail(interaction.id + ' shared_focus needs an attention event for ' + participant);
    }
    const entityById = new Map(scene.entities.map((entity) => [entity.id, entity]));
    const anchorExists = (entityId, anchorName) => {
      const entity = entityById.get(entityId);
      const initial = entity?.states?.[entity.initial_state];
      const asset = initial?.asset ? production.assets?.[initial.asset] : null;
      const rawMaster = asset?.lineage?.source_master;
      const masters = Array.isArray(rawMaster) ? rawMaster : [rawMaster];
      const profiles = masters.filter(Boolean).map((master) => profileByMaster.get(master)).filter(Boolean);
      if (!profiles.length) return true;
      return profiles.some((profile) => Object.prototype.hasOwnProperty.call(profile.anchors ?? {}, anchorName));
    };
    for (const anchor of interaction.anchors ?? []) {
      if (!entityIds.has(anchor.entity)) fail(interaction.id + ' anchor references missing entity ' + anchor.entity);
      if (!anchorExists(anchor.entity, anchor.anchor)) fail(interaction.id + ' unknown anchor ' + anchor.entity + ':' + anchor.anchor);
      if (anchor.target_entity && !entityIds.has(anchor.target_entity)) fail(interaction.id + ' anchor target references missing entity ' + anchor.target_entity);
      if (anchor.target_entity && anchor.target_anchor && !anchorExists(anchor.target_entity, anchor.target_anchor)) fail(interaction.id + ' unknown target anchor ' + anchor.target_entity + ':' + anchor.target_anchor);
    }
  }
}
console.log('Interaction choreography PASS');
