import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveCaptionWordLines, validateCaptionWords} from '../src/caption-karaoke.mjs';
import {resolveCaptionLayout} from '../src/caption-layout.mjs';

const caption = () => ({text:'Bọ Cạp, xin chào!',start_frame:10,end_frame:30,
  resolved_layout:{lines:['Bọ Cạp,','xin chào!']},
  words:[{text:'Bọ',start_frame:10,end_frame:14},{text:'Cạp',start_frame:14,end_frame:18},
    {text:'xin',start_frame:20,end_frame:24},{text:'chào',start_frame:24,end_frame:30}]});

test('karaoke follows measured word intervals, preserving punctuation and line breaks',()=>{
  const c=caption();
  const lines=resolveCaptionWordLines(c,16);
  assert.equal(lines.map(line=>line.map(part=>part.text).join('')).join('\n'),'Bọ Cạp,\nxin chào!');
  assert.deepEqual(lines.flat().filter(part=>part.active).map(part=>part.text),['Cạp']);
  assert.equal(lines.flat().find(part=>part.active).lift,2);
  assert.equal(resolveCaptionWordLines(c,19).flat().filter(part=>part.active).length,0);
  assert.equal(resolveCaptionWordLines(c,30).flat().filter(part=>part.active).length,0);
  delete c.words;
  assert.equal(resolveCaptionWordLines(c,16).flat().filter(part=>part.active).length,0);
});

test('invalid, overlapping or mismatched timing fails validation',()=>{
  for(const mutate of [c=>c.words[0].text='sai',c=>c.words[1].start_frame=12,
    c=>c.words[0].end_frame=Infinity,c=>c.words.pop(),c=>c.words[0].start_frame=0]) {
    const c=caption();mutate(c);
    assert.throws(()=>validateCaptionWords(c),/CAPTION_WORD_TIMING_INVALID/);
  }
});

test('layout reserves room for stroke and bounce even with zero authored padding',()=>{
  const layout=resolveCaptionLayout({id:'test'}, {caption:{padding_px:0,
    safe_zone:{x:0,y:0,width:200,height:120}}},{width:200,height:120},'Bọ',()=>80);
  assert.equal(layout.zone.padding,4);
  assert.ok(layout.y-4>=layout.zone.y);
  assert.ok(layout.y+layout.height+2<=layout.zone.y+layout.zone.height);
});
