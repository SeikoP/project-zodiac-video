import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSceneSetIdentity} from '../validate-scene-set-identity.mjs';
const production={assets:{A:{path:'assets/a.svg'},B:{path:'assets/b.svg'}},scenes:[{id:'S01',environment:{profile:'classroom-study',scene_set:{asset:'A'}}},{id:'S02',environment:{profile:'cafe-chat',scene_set:{asset:'B'}}}]};
test('visually identical scene sets for distinct profiles are blocked',()=>{const r=validateSceneSetIdentity(production,{'assets/a.svg':'<svg>same</svg>','assets/b.svg':'<svg>same</svg>'});assert.ok(r.issues.some(x=>x.code==='SCENE_SET_IDENTITY_COLLISION'));});
test('distinct scene set drawings pass',()=>assert.equal(validateSceneSetIdentity(production,{'assets/a.svg':'<svg>A</svg>','assets/b.svg':'<svg>B</svg>'}).status,'PASS'));
test('scenes without authored scene sets do not require a new asset',()=>{const p=structuredClone(production);delete p.scenes[0].environment.scene_set;delete p.scenes[1].environment.scene_set;assert.equal(validateSceneSetIdentity(p,{}).status,'PASS')});
test('missing declared scene set fails closed',()=>{const r=validateSceneSetIdentity(production,{'assets/a.svg':'<svg>A</svg>'});assert.ok(r.issues.some(x=>x.code==='SCENE_SET_ASSET_MISSING'))});
