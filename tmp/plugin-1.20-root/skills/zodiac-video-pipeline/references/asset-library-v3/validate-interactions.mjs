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
const schema = JSON.parse(await readFile(path.join(root, 'interaction-plan.schema.json'), 'utf8'));
const fail = (msg) => { throw new Error('INTERACTION_CHOREOGRAPHY: ' + msg); };

const assertObjectShape = (value, shape, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label + ' must be an object');
  const allowed = new Set(Object.keys(shape.properties ?? {}));
  for (const key of Object.keys(value)) if (shape.additionalProperties === false && !allowed.has(key)) fail(label + ' contains unknown field ' + key);
  for (const key of shape.required ?? []) if (!(key in value)) fail(label + ' is missing required field ' + key);
};
const assertString = (value, label, minLength = 0) => {
  if (typeof value !== 'string' || value.length < minLength) fail(label + ' must be a string' + (minLength ? ' with minLength ' + minLength : ''));
};
const assertStringArray = (value, spec, label) => {
  if (!Array.isArray(value)) fail(label + ' must be an array');
  if (spec.minItems !== undefined && value.length < spec.minItems) fail(label + ' needs at least ' + spec.minItems + ' item(s)');
  if (spec.maxItems !== undefined && value.length > spec.maxItems) fail(label + ' allows at most ' + spec.maxItems + ' item(s)');
  for (const item of value) assertString(item, label + ' item', spec.items?.minLength ?? 0);
  if (spec.uniqueItems && new Set(value).size !== value.length) fail(label + ' must contain unique values');
};
const enumSet = (spec) => new Set(spec.enum ?? []);

assertObjectShape(plan, schema, 'interaction plan');
if (plan.version !== schema.properties.version.const) fail('interaction plan version must be ' + schema.properties.version.const);
if (!Array.isArray(plan.scenes)) fail('interaction plan scenes must be an array');

const sceneSchema = schema.$defs.scene;
const interactionSchema = schema.$defs.interaction;
const anchorSchema = interactionSchema.properties.anchors.items;
const ownershipSchema = interactionSchema.properties.ownership;
const validTypes = enumSet(interactionSchema.properties.type);
const validResolutions = enumSet(interactionSchema.properties.resolution);
const knownSlots = new Set(Object.values(interactionMap.scene_slots ?? {}).flatMap((slots) => Object.keys(slots)));
const profileByMaster = new Map();
for (const profile of Object.values(interactionMap.character_profiles ?? {})) {
  for (const master of profile.applies_to ?? []) profileByMaster.set(master, profile);
}
const relationalAction = /look|gaze|show|give|take|offer|reach|hold|release|approach|move|step|turn|react|comfort|touch|pull|push|follow|avoid|confront|interrupt|reveal|catch|sit|leave|enter|notice|share|block|freeze/iu;

const sceneById = new Map((production.scenes ?? []).map((scene) => [scene.id, scene]));
const interactionIds = new Set();
const plannedSceneIds = new Set();

for (const scenePlan of plan.scenes) {
  assertObjectShape(scenePlan, sceneSchema, 'scene plan');
  assertString(scenePlan.scene_id, 'scene plan scene_id', sceneSchema.properties.scene_id.minLength ?? 0);
  if (plannedSceneIds.has(scenePlan.scene_id)) fail('duplicate scene plan ' + scenePlan.scene_id);
  plannedSceneIds.add(scenePlan.scene_id);
  if (!Array.isArray(scenePlan.interactions) || scenePlan.interactions.length < (sceneSchema.properties.interactions.minItems ?? 0)) {
    fail('scene ' + scenePlan.scene_id + ' needs at least one interaction');
  }

  const scene = sceneById.get(scenePlan.scene_id);
  if (!scene) fail('unknown scene ' + scenePlan.scene_id);
  const entityIds = new Set((scene.entities ?? []).map((entity) => entity.id));
  const entityById = new Map((scene.entities ?? []).map((entity) => [entity.id, entity]));
  const eventIndex = new Map((scene.events ?? []).map((event, index) => [event.id, index]));
  const eventById = new Map((scene.events ?? []).map((event) => [event.id, event]));

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

  for (const interaction of scenePlan.interactions) {
    assertObjectShape(interaction, interactionSchema, 'interaction');
    assertString(interaction.id, 'interaction id', interactionSchema.properties.id.minLength ?? 0);
    if (interactionIds.has(interaction.id)) fail('interaction IDs must be unique: ' + interaction.id);
    interactionIds.add(interaction.id);

    if (!validTypes.has(interaction.type)) fail(interaction.id + ' has unsupported interaction type');
    if (!validResolutions.has(interaction.resolution)) fail(interaction.id + ' has invalid resolution');
    assertStringArray(interaction.participants, interactionSchema.properties.participants, interaction.id + ' participants');
    assertString(interaction.initiator, interaction.id + ' initiator', interactionSchema.properties.initiator.minLength ?? 0);
    assertStringArray(interaction.responders, interactionSchema.properties.responders, interaction.id + ' responders');
    assertStringArray(interaction.event_ids, interactionSchema.properties.event_ids, interaction.id + ' event_ids');
    assertString(interaction.intent, interaction.id + ' intent', interactionSchema.properties.intent.minLength ?? 0);

    if (interaction.shared_prop !== undefined) assertString(interaction.shared_prop, interaction.id + ' shared_prop', interactionSchema.properties.shared_prop.minLength ?? 0);
    if (interaction.scene_slot !== undefined) {
      assertString(interaction.scene_slot, interaction.id + ' scene_slot');
      if (!knownSlots.has(interaction.scene_slot)) fail(interaction.id + ' references unknown scene_slot ' + interaction.scene_slot);
    }
    if (interaction.ownership !== undefined) {
      assertObjectShape(interaction.ownership, ownershipSchema, interaction.id + ' ownership');
      assertString(interaction.ownership.before, interaction.id + ' ownership.before');
      assertString(interaction.ownership.after, interaction.id + ' ownership.after');
    }
    if (interaction.anchors !== undefined) {
      if (!Array.isArray(interaction.anchors)) fail(interaction.id + ' anchors must be an array');
      for (const [anchorIndex, anchor] of interaction.anchors.entries()) {
        const label = interaction.id + ' anchor[' + anchorIndex + ']';
        assertObjectShape(anchor, anchorSchema, label);
        assertString(anchor.entity, label + '.entity');
        assertString(anchor.anchor, label + '.anchor');
        if (anchor.target_entity !== undefined) assertString(anchor.target_entity, label + '.target_entity');
        if (anchor.target_anchor !== undefined) assertString(anchor.target_anchor, label + '.target_anchor');
        if (anchor.target_anchor && !anchor.target_entity) fail(label + ' target_anchor requires target_entity');
      }
    }

    for (const entityId of interaction.participants) if (!entityIds.has(entityId)) fail(interaction.id + ' references missing participant ' + entityId);
    if (!interaction.participants.includes(interaction.initiator)) fail(interaction.id + ' initiator must be a participant');
    for (const responder of interaction.responders) if (!interaction.participants.includes(responder)) fail(interaction.id + ' responder must be a participant: ' + responder);

    const indexes = interaction.event_ids.map((id) => {
      if (!eventIndex.has(id)) fail(interaction.id + ' references missing event ' + id);
      return eventIndex.get(id);
    });
    for (let i = 1; i < indexes.length; i++) if (indexes[i] <= indexes[i - 1]) fail(interaction.id + ' event_ids must follow production event order');
    const events = interaction.event_ids.map((id) => eventById.get(id));
    const changedTargets = new Set(events.filter((e) => e.target !== 'camera' && e.state_before !== e.state_after).map((e) => e.target));
    const participantChanges = interaction.participants.filter((id) => changedTargets.has(id));
    if (participantChanges.length < 2 && !(interaction.shared_prop && participantChanges.length >= 1 && changedTargets.has(interaction.shared_prop))) {
      fail(interaction.id + ' must visibly change at least two participants, or one participant plus the shared prop');
    }
    if (!events.some((e) => relationalAction.test(e.action))) fail(interaction.id + ' has no relational action');

    const initiatorIndexes = events.map((event, index) => event.target === interaction.initiator ? index : -1).filter((index) => index >= 0);
    if (!initiatorIndexes.length) fail(interaction.id + ' initiator must receive an event');
    const initiatorLast = Math.max(...initiatorIndexes);
    for (const responder of interaction.responders) {
      const responderAfter = events.findIndex((event, index) => index > initiatorLast && event.target === responder);
      if (responderAfter < 0) fail(interaction.id + ' responder ' + responder + ' needs a response after initiator activity');
    }

    if (['handoff', 'offer_take'].includes(interaction.type)) {
      if (!interaction.shared_prop || !entityIds.has(interaction.shared_prop)) fail(interaction.id + ' handoff needs an existing shared_prop');
      if (!interaction.ownership?.before || !interaction.ownership?.after || interaction.ownership.before === interaction.ownership.after) fail(interaction.id + ' handoff needs ownership.before != ownership.after');
      if (!interaction.participants.includes(interaction.ownership.before) || !interaction.participants.includes(interaction.ownership.after)) fail(interaction.id + ' ownership endpoints must be participants');
      if (!events.some((event) => event.target === interaction.shared_prop)) fail(interaction.id + ' shared prop must receive an event during transfer');
      if (!events.some((event) => event.target === interaction.ownership.before) || !events.some((event) => event.target === interaction.ownership.after)) fail(interaction.id + ' both old and new owners must participate in transfer events');
    }

    if (interaction.type === 'shared_focus') {
      const attentionEvents = events.filter((event) => /look|gaze|turn|notice|show|reveal|screen/iu.test(event.action));
      if (attentionEvents.length < 2) fail(interaction.id + ' shared_focus needs at least two attention/reveal events');
      const attentionTargets = new Set(attentionEvents.map((event) => event.target));
      for (const participant of interaction.participants) if (!attentionTargets.has(participant)) fail(interaction.id + ' shared_focus needs an attention event for ' + participant);
    }

    for (const anchor of interaction.anchors ?? []) {
      if (!entityIds.has(anchor.entity)) fail(interaction.id + ' anchor references missing entity ' + anchor.entity);
      if (!anchorExists(anchor.entity, anchor.anchor)) fail(interaction.id + ' unknown anchor ' + anchor.entity + ':' + anchor.anchor);
      if (anchor.target_entity && !entityIds.has(anchor.target_entity)) fail(interaction.id + ' anchor target references missing entity ' + anchor.target_entity);
      if (anchor.target_entity && anchor.target_anchor && !anchorExists(anchor.target_entity, anchor.target_anchor)) fail(interaction.id + ' unknown target anchor ' + anchor.target_entity + ':' + anchor.target_anchor);
    }
  }
}
console.log('Interaction choreography PASS');
