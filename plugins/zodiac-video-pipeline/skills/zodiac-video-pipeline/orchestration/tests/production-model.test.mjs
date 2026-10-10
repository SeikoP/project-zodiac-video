import test from 'node:test';import assert from 'node:assert/strict';
import {validateProductionModel,canonicalizeProductionModel,getOwnedField} from '../production-model.mjs';
import {canonicalDigest} from '../verify-release-sync.mjs';
const model={format:'zodiac-production-model@1',narration:'Bọ Cạp nói không sao.',scenes:[{id:'S01',actions:[]}]};
test('canonical model succeeds',()=>assert.equal(validateProductionModel(model).ok,true));
test('immutable approved narration',()=>assert.ok(validateProductionModel({...model,narration:'other'},{narrationChecksum:canonicalDigest(model.narration)}).errors.includes('APPROVED_NARRATION_CHANGED')));
test('projections cannot become alternate truth',()=>assert.ok(validateProductionModel({...model,projections:{'asset-plan':{foo:1}}}).errors.includes('PROJECTIONS_NOT_AUTHORITATIVE')));
test('canonical hashes insensitive to order',()=>assert.equal(canonicalizeProductionModel(model),canonicalizeProductionModel({scenes:model.scenes,narration:model.narration,format:model.format})));
test('unowned field fails',()=>assert.throws(()=>getOwnedField('meme',{paths:{}}),/UNOWNED_FIELD/));
