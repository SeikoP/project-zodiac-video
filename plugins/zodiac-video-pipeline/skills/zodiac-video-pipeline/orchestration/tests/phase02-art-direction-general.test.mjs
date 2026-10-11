import test from 'node:test';import assert from 'node:assert/strict';
import {validatePhase02ArtDirection} from '../validate-phase02-art-direction.mjs';
const palettes={palettes:{'school-warm':{},'social-teal':{}}},environments={profiles:['classroom-study','cafe-chat']};
const source={scenes:[{id:'S01',voice:'Đầu.',environment:{profile:'classroom-study'},entities:[]},{id:'S02',voice:'Cuối.',environment:{profile:'cafe-chat'},entities:[]}]};
const plan={format:'zodiac-scene-art-direction@2',scenes:[
 {id:'S01',voice:'Đầu.',palette_id:'school-warm',environment_profile:'classroom-study',performer:'character',action:'Giới thiệu',semantic_goal:'Cảm xúc',color_reason:'Ấm',environment_reason:'Học đường',story_object:null},
 {id:'S02',voice:'Cuối.',palette_id:'social-teal',environment_profile:'cafe-chat',performer:'character',action:'Kết lại',semantic_goal:'Đổi ý',color_reason:'Dịu',environment_reason:'Quán',story_object:null}]};
const q=p=>validatePhase02ArtDirection(source,p,'Đầu.\n\nCuối.',palettes,environments);
test('works for any sign without hard-coded Taurus entities and no mandated story object',()=>assert.equal(q(plan).status,'PASS'));
test('rejects palette outside canonical registry',()=>{const p=structuredClone(plan);p.scenes[1].palette_id='neon';assert.ok(q(p).issues.some(i=>i.code==='PALETTE_UNKNOWN'));});
test('rejects narrative/scene profile mismatch',()=>{const p=structuredClone(plan);p.scenes[0].environment_profile='cafe-chat';assert.ok(q(p).issues.some(i=>i.code==='ENVIRONMENT_PROFILE_MISMATCH'));});
test('rejects metaphor pretending to replace background',()=>{const p=structuredClone(plan);p.scenes[1].story_object={id:'anchor',render_layer:'background',replaces_environment:true};assert.ok(q(p).issues.some(i=>i.code==='STORY_OBJECT_BACKGROUND_FORBIDDEN'));});
test('rejects art direction changing approved voice',()=>{const p=structuredClone(plan);p.scenes[0].voice='không đúng';assert.ok(q(p).issues.some(i=>i.code==='ART_VOICE_MISMATCH'));});
