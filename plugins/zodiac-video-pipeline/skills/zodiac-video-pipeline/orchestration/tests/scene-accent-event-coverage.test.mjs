import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateVisualCoverage} from '../../features/visual-composition/validate-visual-coverage.mjs';

test('fresh canvas accent entering on narration is counted as visible in its beat', () => {
  const voice='Quán cà phê hiện ra.';
  const accent={
    id:'cafe_window',kind:'object',initial_state:'hidden',
    states:{hidden:{visible:false},shown:{visible:true}}
  };
  const scene={
    id:'S01',voice,entities:[accent],
    events:[{id:'show_window',target:'cafe_window',state_after:'shown',
      trigger:{type:'voice_anchor',text:'Quán cà phê',occurrence:1}}],
    layout_contract:{caption_safe_zone:{x:0,y:1400,width:1080,height:400}}
  };
  const omit={decision:'omit',reason:'Not needed for this beat'};
  const planned={
    components:[{id:'cafe_window',visual_role:'scene_accent',narrative_role:'scene_accent'}],
    visual_coverage:{
      format:'zodiac-visual-coverage@1',layers_version:'narrative_visual@1',
      narration_sha256:createHash('sha256').update(voice).digest('hex'),
      beats:[{id:'B01',goal:'Establish cafe context',narration_range:[0,Buffer.byteLength(voice)],
        event_ids:['show_window'],
        layers:{actors:omit,scene_accent:{decision:'use',reason:'Cafe setting',entity_ids:['cafe_window']},
          narrative_visual:omit,props:omit,support:omit,caption:omit}
      }]
    }
  };
  assert.deepEqual(validateVisualCoverage(scene,planned,{required:true}),[]);
});
