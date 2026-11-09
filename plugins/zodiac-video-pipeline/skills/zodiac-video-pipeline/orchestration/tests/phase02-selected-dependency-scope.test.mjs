import test from 'node:test';
import assert from 'node:assert/strict';
import {stepUsesSvgDependency} from '../../phases/phase02/phase02-selected-dependencies.mjs';

const character='/repo/references/asset-library-v4/characters/hair/a.svg';
const environment='/repo/references/asset-library-v4/environments/room.svg';
const meme='/repo/references/asset-library-v4/memes/card.svg';

test('raw SVG invalidation is limited to native owners that consume those assets',()=>{
 assert.equal(stepUsesSvgDependency('references/asset-library-v4/characters/compile-character-assembly.mjs','character_write',character),true);
 assert.equal(stepUsesSvgDependency('references/asset-library-v4/characters/compile-character-assembly.mjs','character_write',environment),false);
 assert.equal(stepUsesSvgDependency('references/asset-library-v4/environments/compile-environment.mjs','environment',environment),true);
 assert.equal(stepUsesSvgDependency('references/asset-library-v4/memes/compile-meme-props.mjs','meme_props',meme),true);
 assert.equal(stepUsesSvgDependency('references/asset-library-v4/scene-direction/compile-scene-direction.mjs','scene_direction',character),true);
 assert.equal(stepUsesSvgDependency('features/visual-composition/validate-authoring-scene-events.mjs','scene_events',character),false);
 assert.equal(stepUsesSvgDependency('features/visual-composition/validate-motion-consistency.mjs','motion_consistency',environment),false);
 assert.equal(stepUsesSvgDependency('features/publish/validate-publish-prep.mjs','publish_prep',meme),false);
});
