const mechanical = /(?:^|_)(open|close|fold|unfold|zip|unzip|unlock|lock|insert|remove|pick|place|hold|release|hand|turn_page|drawer|curtain|door|lid|flap|notify|notification|screen_change|lamp_on|lamp_off|light_on|light_off|wear|remove_mask)(?:_|$)/iu;
const strong = /(?:^|_)(open|close|fold|unfold|zip|unzip|insert|remove|pick|place|hold|release|turn_page|drawer|curtain|door|lid|flap|wear|remove_mask)(?:_|$)/iu;
export const validateSemanticAnimation = (scene) => {
  const entityIds = new Set(scene.entities.map((entity)=>entity.id));
  for (const event of scene.events ?? []) {
    if (event.target === 'camera' || !mechanical.test(String(event.action))) continue;
    const mechanism = event.mechanism;
    if (!mechanism) throw new Error('SEMANTIC_ANIMATION_GATE: mechanical event requires mechanism declaration: ' + event.id);
    if (mechanism.mode === 'child_entities') {
      if (!Array.isArray(mechanism.parts) || mechanism.parts.length === 0) throw new Error('SEMANTIC_ANIMATION_GATE: child_entities needs parts: ' + event.id);
      for (const part of mechanism.parts) if (!entityIds.has(part)) throw new Error('SEMANTIC_ANIMATION_GATE: mechanism part is not a scene entity: ' + event.id + ':' + part);
    } else if (mechanism.mode === 'whole_asset') {
      if (strong.test(String(event.action))) throw new Error('SEMANTIC_ANIMATION_GATE: strong articulation action cannot use whole_asset: ' + event.id);
      if (!String(mechanism.justification ?? '').trim() || String(mechanism.justification).trim().length < 20) throw new Error('SEMANTIC_ANIMATION_GATE: whole_asset requires a concrete justification: ' + event.id);
    } else throw new Error('SEMANTIC_ANIMATION_GATE: unsupported mechanism mode: ' + event.id);
  }
};
