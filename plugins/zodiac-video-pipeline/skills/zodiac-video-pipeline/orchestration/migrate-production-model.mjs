import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {normalizeMotion} from './normalize-motion.mjs';
import {validateProductionModel} from './production-model.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
export function migrateLegacyJob5(root){
 const irBytes=fs.readFileSync(path.join(root,'production.ir.json'));
 const ir=JSON.parse(irBytes);const narration=fs.readFileSync(path.join(root,'narration.txt'),'utf8');
 const design=JSON.parse(fs.readFileSync(path.join(root,'design-token.json'),'utf8'));
 const publish=JSON.parse(fs.readFileSync(path.join(root,'publish/publish.json'),'utf8'));
 const scenes=ir.scenes.map(s=>({...s,actions:s.events.map(e=>({id:e.id,target:e.target,intent:e.intent,trigger:e.trigger,states:{before:e.state_before,after:e.state_after},motion:normalizeMotion(e.desired_motion),scheduling:e.scheduling})),events:undefined}));
 for(const s of scenes)delete s.events;
 const model={format:'zodiac-production-model@1',narration,scenes,assets:ir.assets,design,publish,source:{origin:'reconstructed',narration_sha256:sha(narration),legacy_ir_sha256:sha(irBytes),legacy_format:ir.format,legacy_fps:ir.fps,legacy_video:ir.video}};
 const checked=validateProductionModel(model);if(!checked.ok)throw new Error(checked.errors.join(','));return model;
}
