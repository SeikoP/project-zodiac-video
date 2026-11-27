#!/usr/bin/env node
// Fixed 6-paragraph skeleton check for short-form narration (see narration-skeleton.md).
// Structure only: it proves the shape, never that the writing is good. Output is REVIEW, never an approval.
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const SKELETON={
 paragraphs:6,
 hook_max_tokens:16,
 facet_tokens:[20,60],
 turn_tokens:[10,40],
 close_max_tokens:25,
 total_tokens:[120,300],
 sentence_max_tokens:20,
 min_callback_words:2,
 topic_word_paragraphs:4
};
const STOP=new Set(['và','của','có','không','một','này','đó','cũng','thì','mà','như','cho','với','được','khi','đã','rồi','lại','cái','những','nó','là','bạn','họ','mình','vì','để','ra','vào','nên','chỉ','còn','cả','hay','nhưng','thế','sẽ','đang','từ','trong','lúc','nào','ai']);
const CONTRAST=['nhưng','vậy mà','thế mà','trong khi','thật ra','chứ không','ngược lại','mà lại'];
const FILLER=['về cơ bản','nói chung','thật ra thì','như các bạn biết','hôm nay chúng ta','hôm nay mình','chào mọi người','xin chào','các bạn ơi','đừng quên'];
const CTA=['theo dõi','follow','like','share','chia sẻ','đăng ký','bình luận','comment','phần sau','phần tiếp','tập sau'];
const words=s=>(String(s).toLowerCase().match(/[\p{L}\p{N}]+/gu)??[]);
const has=(text,phrase)=>(' '+words(text).join(' ')+' ').includes(' '+words(phrase).join(' ')+' ');

export function checkSkeleton(text,limits=SKELETON){
 const paras=String(text).replace(/\r\n/g,'\n').split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean);
 const issues=[],add=(code,where,detail)=>issues.push({code,where,detail});
 const count=paras.map(p=>words(p).length),total=count.reduce((a,b)=>a+b,0);
 if(paras.length!==limits.paragraphs){add('SLOT_COUNT','all','need exactly '+limits.paragraphs+' paragraphs (hook, 3 facets, turn, close); found '+paras.length);return report(paras,count,total,issues);}
 const [hook,f1,f2,f3,turn,close]=paras,[hc,,,,tc,cc]=count;
 if(hc>limits.hook_max_tokens)add('HOOK_LONG','hook',hc+' tokens, max '+limits.hook_max_tokens);
 [f1,f2,f3].forEach((p,i)=>{
  const n=count[i+1],where='facet'+(i+1);
  if(n<limits.facet_tokens[0]||n>limits.facet_tokens[1])add('FACET_SIZE',where,n+' tokens, need '+limits.facet_tokens.join('-'));
  if(!CONTRAST.some(c=>has(p,c)))add('FACET_NO_CONTRAST',where,'no surface-versus-inside marker ('+CONTRAST.join(', ')+')');
 });
 if(tc<limits.turn_tokens[0]||tc>limits.turn_tokens[1])add('TURN_SIZE','turn',tc+' tokens, need '+limits.turn_tokens.join('-'));
 if(cc>limits.close_max_tokens)add('CLOSE_LONG','close',cc+' tokens, max '+limits.close_max_tokens);
 if(total<limits.total_tokens[0]||total>limits.total_tokens[1])add('TOTAL_SIZE','all',total+' tokens, need '+limits.total_tokens.join('-'));
 // The close must return to the hook with words that are not the topic itself (a word present in most paragraphs is the sign name or subject).
 const sets=paras.map(p=>new Set(words(p)));
 const topic=new Set([...new Set(sets.flatMap(s=>[...s]))].filter(w=>sets.filter(s=>s.has(w)).length>=limits.topic_word_paragraphs));
 const shared=[...sets[0]].filter(w=>sets[5].has(w)&&!STOP.has(w)&&!topic.has(w));
 if(shared.length<limits.min_callback_words)add('CLOSE_NO_CALLBACK','close','shares '+shared.length+' non-topic words with the hook, need '+limits.min_callback_words);
 for(const phrase of CTA)if(has(close,phrase))add('CLOSE_CTA','close','"'+phrase+'" turns the ending into a goodbye; keep any call to action in the caption');
 paras.forEach((p,i)=>{
  for(const phrase of FILLER)if(has(p,phrase))add('FILLER','p'+(i+1),'"'+phrase+'" is read aloud by TTS and adds no information');
  for(const s of p.split(/[.!?…]+|\n/).map(x=>x.trim()).filter(Boolean)){const n=words(s).length;if(n>limits.sentence_max_tokens)add('SENTENCE_LONG','p'+(i+1),n+' tokens: "'+s.slice(0,60)+'…"');}
 });
 return report(paras,count,total,issues);
}
// Situation mode: one sign walks through one relatable situation; each paragraph is one concrete moment, in time order.
export const SITUATION={
 paragraphs:[8,16],
 hook_max_tokens:16,
 moment_tokens:[15,45],
 turn_tokens:[10,40],
 close_max_tokens:35,
 total_tokens:[220,480],
 sentence_max_tokens:20,
 min_contrast_moments:2,
 min_callback_words:2,
 topic_word_share:0.4
};
export function checkSituation(text,limits=SITUATION){
 const paras=String(text).replace(/\r\n/g,'\n').split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean);
 const issues=[],add=(code,where,detail)=>issues.push({code,where,detail});
 const count=paras.map(p=>words(p).length),total=count.reduce((a,b)=>a+b,0);
 if(paras.length<limits.paragraphs[0]||paras.length>limits.paragraphs[1]){add('SLOT_COUNT','all','need '+limits.paragraphs.join('-')+' paragraphs (hook, moments, turn, close); found '+paras.length);return report(paras,count,total,issues,'situation');}
 const hook=paras[0],close=paras.at(-1),turn=paras.at(-2),moments=paras.slice(1,-2);
 if(count[0]>limits.hook_max_tokens)add('HOOK_LONG','hook',count[0]+' tokens, max '+limits.hook_max_tokens);
 moments.forEach((p,i)=>{
  const n=count[i+1],where='moment'+(i+1);
  if(n<limits.moment_tokens[0]||n>limits.moment_tokens[1])add('MOMENT_SIZE',where,n+' tokens, need '+limits.moment_tokens.join('-'));
  const lead=words(p).slice(0,3).join(' ');
  if(i>0&&lead===words(moments[i-1]).slice(0,3).join(' '))add('MOMENT_SAME_OPENING',where,'starts like the previous moment ("'+lead+'"): list-like, not escalating');
 });
 if(moments.filter(p=>CONTRAST.some(c=>has(p,c))).length<limits.min_contrast_moments)add('TOO_FEW_CONTRASTS','moments','need at least '+limits.min_contrast_moments+' moments where the outside and the inside disagree ('+CONTRAST.join(', ')+')');
 if(count.at(-2)<limits.turn_tokens[0]||count.at(-2)>limits.turn_tokens[1])add('TURN_SIZE','turn',count.at(-2)+' tokens, need '+limits.turn_tokens.join('-'));
 if(count.at(-1)>limits.close_max_tokens)add('CLOSE_LONG','close',count.at(-1)+' tokens, max '+limits.close_max_tokens);
 if(total<limits.total_tokens[0]||total>limits.total_tokens[1])add('TOTAL_SIZE','all',total+' tokens, need '+limits.total_tokens.join('-'));
 const sets=paras.map(p=>new Set(words(p)));
 const topic=new Set([...new Set(sets.flatMap(s=>[...s]))].filter(w=>sets.filter(s=>s.has(w)).length>=Math.ceil(limits.topic_word_share*paras.length)));
 const shared=[...sets[0]].filter(w=>sets.at(-1).has(w)&&!STOP.has(w)&&!topic.has(w));
 if(shared.length<limits.min_callback_words)add('CLOSE_NO_CALLBACK','close','shares '+shared.length+' non-topic words with the hook, need '+limits.min_callback_words);
 for(const phrase of CTA)if(has(close,phrase))add('CLOSE_CTA','close','"'+phrase+'" turns the ending into a goodbye; keep any call to action in the caption');
 paras.forEach((p,i)=>{
  for(const phrase of FILLER)if(has(p,phrase))add('FILLER','p'+(i+1),'"'+phrase+'" is read aloud by TTS and adds no information');
  for(const s of p.split(/[.!?…]+|\n/).map(x=>x.trim()).filter(Boolean)){const n=words(s).length;if(n>limits.sentence_max_tokens)add('SENTENCE_LONG','p'+(i+1),n+' tokens: "'+s.slice(0,60)+'…"');}
 });
 return report(paras,count,total,issues,'situation');
}
// Long-profile mode: the shape shared by the three reference subtitles (dealbreakers, outer vs inner, dark side, warm side, one closing line).
export const LONG_PROFILE={
 slots:['hook','dealbreaker1','dealbreaker2','dealbreaker3','outer','dark','night','warm','turn','close'],
 hook_max_tokens:24,
 hook_evidence_tokens:16,
 dealbreaker_tokens:[30,70],
 ordinals:['thứ nhất','thứ hai','thứ ba'],
 facet_tokens:[50,90],
 contrast_slots:['outer','dark','night'],
 turn_tokens:[15,55],
 close_max_tokens:55,
 total_tokens:[450,750],
 sentence_max_tokens:22,
 min_callback_words:2,
 topic_word_share:0.4
};
export function checkLongProfile(text,limits=LONG_PROFILE){
 const paras=String(text).replace(/\r\n/g,'\n').split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean);
 const issues=[],add=(code,where,detail)=>issues.push({code,where,detail});
 const count=paras.map(p=>words(p).length),total=count.reduce((a,b)=>a+b,0);
 if(paras.length!==limits.slots.length){add('SLOT_COUNT','all','need exactly '+limits.slots.length+' paragraphs ('+limits.slots.join(', ')+'); found '+paras.length);return report(paras,count,total,issues,'long-profile');}
 const at=Object.fromEntries(limits.slots.map((s,i)=>[s,i]));
 if(count[at.hook]>limits.hook_max_tokens)add('HOOK_LONG','hook',count[at.hook]+' tokens, max '+limits.hook_max_tokens);
 const firstSentence=words(paras[at.hook].split(/[.!?…]+/)[0]).length;
 if(firstSentence>limits.hook_evidence_tokens)add('HOOK_EVIDENCE_LATE','hook','the promise ends at token '+firstSentence+'; retention needs it by token '+limits.hook_evidence_tokens);
 ['dealbreaker1','dealbreaker2','dealbreaker3'].forEach((s,k)=>{
  const n=count[at[s]];
  if(n<limits.dealbreaker_tokens[0]||n>limits.dealbreaker_tokens[1])add('DEALBREAKER_SIZE',s,n+' tokens, need '+limits.dealbreaker_tokens.join('-'));
  if(!(' '+words(paras[at[s]]).slice(0,3).join(' ')+' ').includes(' '+limits.ordinals[k]+' '))add('DEALBREAKER_ORDINAL',s,'open with "'+limits.ordinals[k]+'" so the number promised in the hook is kept');
 });
 for(const s of ['outer','dark','night','warm']){const n=count[at[s]];if(n<limits.facet_tokens[0]||n>limits.facet_tokens[1])add('FACET_SIZE',s,n+' tokens, need '+limits.facet_tokens.join('-'));}
 for(const s of limits.contrast_slots)if(!CONTRAST.some(c=>has(paras[at[s]],c)))add('FACET_NO_CONTRAST',s,'no outside-versus-inside marker ('+CONTRAST.join(', ')+')');
 if(count[at.turn]<limits.turn_tokens[0]||count[at.turn]>limits.turn_tokens[1])add('TURN_SIZE','turn',count[at.turn]+' tokens, need '+limits.turn_tokens.join('-'));
 if(count[at.close]>limits.close_max_tokens)add('CLOSE_LONG','close',count[at.close]+' tokens, max '+limits.close_max_tokens);
 if(total<limits.total_tokens[0]||total>limits.total_tokens[1])add('TOTAL_SIZE','all',total+' tokens, need '+limits.total_tokens.join('-'));
 const sets=paras.map(p=>new Set(words(p)));
 const topic=new Set([...new Set(sets.flatMap(s=>[...s]))].filter(w=>sets.filter(s=>s.has(w)).length>=Math.ceil(limits.topic_word_share*paras.length)));
 const shared=[...sets[at.hook]].filter(w=>sets[at.close].has(w)&&!STOP.has(w)&&!topic.has(w));
 if(shared.length<limits.min_callback_words)add('CLOSE_NO_CALLBACK','close','shares '+shared.length+' non-topic words with the hook, need '+limits.min_callback_words);
 for(const phrase of CTA)if(has(paras[at.close],phrase))add('CLOSE_CTA','close','"'+phrase+'" turns the ending into a goodbye; keep any call to action in the caption');
 paras.forEach((p,i)=>{
  for(const phrase of FILLER)if(has(p,phrase))add('FILLER',limits.slots[i],'"'+phrase+'" is read aloud by TTS and adds no information');
  for(const s of p.split(/[.!?…]+|\n/).map(x=>x.trim()).filter(Boolean)){const n=words(s).length;if(n>limits.sentence_max_tokens)add('SENTENCE_LONG',limits.slots[i],n+' tokens: "'+s.slice(0,60)+'…"');}
 });
 return report(paras,count,total,issues,'long-profile');
}
function report(paras,count,total,issues,mode='profile'){
 return {format:'zodiac-narration-skeleton@1',mode,status:issues.length?'REVIEW':'PASS',paragraphs:paras.length,tokens_per_paragraph:count,total_tokens:total,estimated_seconds:Math.round(total/4.5),issues,not_an_approval:true};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const input=process.argv[2];if(!input){console.error('Usage: node validate-narration-skeleton.mjs <workspace|narration.txt> [--mode=short-profile|long-profile|situation]');process.exit(2);}
  const file=(await stat(input)).isFile()?input:await stat(path.join(input,'.authoring/narration.txt')).then(()=>path.join(input,'.authoring/narration.txt')).catch(e=>{if(e.code==='ENOENT')return path.join(input,'narration.txt');throw e;});
  const mode=(process.argv.find(a=>a.startsWith('--mode='))??'--mode=profile').slice(7);
  const check={profile:checkSkeleton,'short-profile':checkSkeleton,situation:checkSituation,'long-profile':checkLongProfile}[mode];if(!check){console.error('Unknown mode '+mode);process.exit(2);}
  const result=check(await readFile(file,'utf8'));
  console.log(JSON.stringify(result,null,2));
  if(result.status!=='PASS')process.exitCode=1;
 }catch(e){console.error(e.message);process.exitCode=2;}
}
