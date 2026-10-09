const aliases = {environment:'background', environment_cue:'background', character_pose:'character', prop:'interactive_prop', object:'interactive_prop', story_prop:'interactive_prop', story_effect:'effect'};
const roles = new Set(['background','character','interactive_prop','foreground_environment','effect','caption','overlay']);
export function resolveVisualRole(entity, assets = {}) {
  const asset = assets[entity.states?.[entity.initial_state]?.asset] ?? {};
  for (const value of [entity.visual_role, entity.role, asset.visual_role, asset.role]) {
    if (value == null) continue;
    const role = aliases[value] ?? value;
    if (!roles.has(role)) throw new Error(`ROLE_RESOLUTION_INVALID entity=${entity.id} role=${value}`);
    return role;
  }
  // Legacy library desk-edge is a structural foreground cue, not an interactive prop.
  const path = String(asset.path ?? '').replaceAll('\\','/').toLowerCase();
  const kind = aliases[entity.kind] ?? entity.kind;
  if (roles.has(kind)) return kind;
  if (asset.category === 'environment' && /\/classroom-desk-edge\.svg$/.test(path)) return 'foreground_environment';
  for (const value of [asset.kind, asset.category]) {
    const role = aliases[value] ?? value;
    if (roles.has(role)) return role;
  }
  for (const [folder, role] of [['characters','character'],['props','interactive_prop'],['effects','effect'],['environment','background'],['environments','background']]) {
    if (path.split('/').includes(folder)) return role;
  }
  if (entity.id === 'story_prop') return 'interactive_prop';
  if (entity.id === 'story_effect') return 'effect';
  if (entity.id.startsWith('env__')) return 'background';
  // Older character-only plans stored no category and used char-<sign>.svg.
  if (/(^|\/)char[-.]/.test(path)) return 'character';
  throw new Error(`ROLE_RESOLUTION_UNKNOWN entity=${entity.id} asset=${asset.path ?? '?'}`);
}

export function resolveLayer(entity, state, assets) {
  const role = resolveVisualRole(entity, assets);
  const authored = state?.layer ?? entity.states?.[entity.initial_state]?.layer ?? entity.layer;
  if (authored != null && (!Number.isFinite(authored) || !Number.isInteger(authored)))
    throw new Error(`LAYER_ORDER_INVALID entity=${entity.id} role=${role} layer=${authored}`);
  return authored ?? {background:-10,character:3,foreground_environment:15,interactive_prop:20,effect:25,caption:90,overlay:100}[role];
}

export function resolveLayerOrder(scene, assets, states) {
  const entities = [...(scene.entities ?? [])];
  const edges = scene.occlusion_relations ?? [];
  const byId = new Map(entities.map(e=>[e.id,e]));
  for (const edge of edges) {
    if (!byId.has(edge.front) || !byId.has(edge.back) || edge.front === edge.back)
      throw new Error(`LAYER_ORDER_INVALID scene=${scene.id} front=${edge.front} back=${edge.back}`);
  }
  const result=[];
  while (entities.length) {
    const ready=entities.filter(e=>!edges.some(edge=>edge.front===e.id && entities.some(other=>other.id===edge.back)));
    ready.sort((a,b)=>resolveLayer(a,states?.[a.id],assets)-resolveLayer(b,states?.[b.id],assets) || (a.id<b.id?-1:a.id>b.id?1:0));
    if (!ready.length) throw new Error(`LAYER_ORDER_CYCLE scene=${scene.id}`);
    result.push(ready[0]); entities.splice(entities.indexOf(ready[0]),1);
  }
  return result;
}
