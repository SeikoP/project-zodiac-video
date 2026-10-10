import assert from 'node:assert/strict';
import test from 'node:test';
import {compileCharacterSvg} from '../compile-character-assembly.mjs';

const gemini = {
  entity_id:'gemini',body_profile:'standard_compact',hair_id:'asym-bang',
  face_profile_id:'wide-set',accessory_id:'none',outfit_id:'gemini-basic-clean',
  shirt_color_id:'teal',variant_seed:'face-grammar-regression'
};
const friend = {
  entity_id:'classmate',body_profile:'round_soft',hair_id:'high-ponytail',
  face_profile_id:'freckled',accessory_id:'none',outfit_id:'generic-soft-stripes',
  shirt_color_id:'coral',variant_seed:'classmate-identity-regression'
};

for (const expression_id of ['neutral','deadpan','panic','smug','side-eye','relieved','cry','exasperated','embarrassed']) {
  test(`friendly expression ${expression_id} avoids old hollow eyes`, () => {
    const {svg} = compileCharacterSvg(gemini,{pose_id:'neutral',expression_id});
    const face = svg.match(/<g id="face_eyes">([\s\S]*?)<\/g>/u)?.[1] ?? '';
    const mouth = svg.match(/<g id="face_mouth">([\s\S]*?)<\/g>/u)?.[1] ?? '';
    assert.ok(face && mouth, 'eyes and mouth groups must exist');
    assert.equal((face.match(/<path\b/gu) ?? []).length,2);
    assert.match(face, /fill="#2F3C44"|stroke="#2F3C44"/u);
    assert.doesNotMatch(face, /M184 282|M294 284|M187 279|M181 289/u);
    assert.doesNotMatch(mouth, /M247 354 Q267 336 288 355/u);
    assert.match(svg, /style=zodiac-paper-doodle-meme-v4;handmade=human-stroke-v2/u);
  });
}

test('school classmate ponytail preserves independent identity across expressions', () => {
  const states=['deadpan','exasperated'].map(expression_id=>
    compileCharacterSvg(friend,{pose_id:'neutral',expression_id}));
  assert.equal(states[0].identity_signature,states[1].identity_signature);
  for(const {svg} of states) {
    assert.match(svg,/hair_id=high-ponytail;/u);
    assert.doesNotMatch(svg,/thief|hair_id=lopsided-bob/u);
    assert.match(svg,/shirt_color_id=coral;shirt_color=#E97A66/u);
  }
});
