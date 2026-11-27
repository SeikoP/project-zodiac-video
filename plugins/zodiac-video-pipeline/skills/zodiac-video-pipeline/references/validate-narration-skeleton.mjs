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
function report(paras,count,total,issues){
 return {format:'zodiac-narration-skeleton@1',status:issues.length?'REVIEW':'PASS',paragraphs:paras.length,tokens_per_paragraph:count,total_tokens:total,estimated_seconds:Math.round(total/4.5),issues,not_an_approval:true};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const input=process.argv[2];if(!input){console.error('Usage: node validate-narration-skeleton.mjs <workspace|narration.txt>');process.exit(2);}
  const file=(await stat(input)).isFile()?input:await stat(path.join(input,'.authoring/narration.txt')).then(()=>path.join(input,'.authoring/narration.txt')).catch(e=>{if(e.code==='ENOENT')return path.join(input,'narration.txt');throw e;});
  const result=checkSkeleton(await readFile(file,'utf8'));
  console.log(JSON.stringify(result,null,2));
  if(result.status!=='PASS')process.exitCode=1;
 }catch(e){console.error(e.message);process.exitCode=2;}
}
