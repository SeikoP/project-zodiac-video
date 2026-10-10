#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const profile=JSON.parse(await readFile(path.join(root,'foundations/human-stroke-profile.json'),'utf8'));
const token=JSON.parse(await readFile(path.join(root,'foundations/style-token.json'),'utf8'));
const fail=m=>{throw new Error('HUMAN_STROKE_INVALID: '+m);};
const group=(svg,id)=>svg.match(new RegExp(`<g\\s+id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/g>`,'u'))?.[1]??null;
const curveCount=svg=>[...svg.matchAll(/<path\b[^>]*\sd=["'][^"']*[QqCcSsTt][^"']*["']/gu)].length;
const primitiveCount=svg=>(svg.match(/<(?:rect|circle|ellipse)\b/giu)||[]).length;
const pathCount=svg=>(svg.match(/<path\b/giu)||[]).length;
const pathD=markup=>[...String(markup??'').matchAll(/<path\b[^>]*\sd=["']([^"']+)["']/gu)].map(m=>m[1]);
const withoutGroup=(svg,id)=>String(svg).replace(new RegExp(`<g\\s+id=["']${id}["'][^>]*>[\\s\\S]*?<\\/g>`,'u'),'');
export function validateHumanStroke(svg,kind='focal'){
  const limits=profile.thresholds[kind];if(!limits)fail('unsupported kind '+kind);
  if(!new RegExp(`style=${token.id}`,'iu').test(svg))fail('missing style='+token.id);
  if(!new RegExp(`handmade=${profile.id}`,'iu').test(svg))fail('missing handmade='+profile.id);
  for(const tag of profile.forbidden_svg_elements??[])if(new RegExp(`<${tag}\\b`,'iu').test(svg))fail('forbidden SVG element '+tag);
  const allowed=new Set(token.palette.map(x=>x.toUpperCase()));for(const c of [...svg.matchAll(/(?:fill|stroke)=["'](#[0-9a-fA-F]{6})["']/gu)].map(m=>m[1].toUpperCase()))if(!allowed.has(c))fail('noncanonical color '+c);
  const strokeMax=limits.stroke_width_max??token.stroke_width.max;const checkedSvg=kind==='character'?withoutGroup(svg,'sticker_edge'):svg;for(const w of [...checkedSvg.matchAll(/stroke-width=["']([0-9.]+)["']/gu)].map(m=>Number(m[1])))if(w<token.stroke_width.min||w>strokeMax)fail(`stroke ${w} outside ${token.stroke_width.min}-${strokeMax}`);
  if(kind==='character'){const edge=group(svg,'sticker_edge');if(!edge||!/(?:fill|stroke)=["']#FFFDF9["']/u.test(edge))fail('character sticker edge must use warm-white cutout ink');for(const w of [...edge.matchAll(/stroke-width=["']([0-9.]+)["']/gu)].map(m=>Number(m[1])))if(w<14||w>28)fail(`sticker edge ${w} outside 14-28 source units`);}
  const curves=curveCount(svg),primitives=primitiveCount(svg),paths=pathCount(svg),denom=Math.max(1,paths+primitives),ratio=primitives/denom;
  if(curves<limits.min_curved_paths)fail(`${kind} needs >=${limits.min_curved_paths} independently curved paths; got ${curves}`);
  if(ratio>limits.max_primitive_ratio)fail(`${kind} primitive dominance ${(ratio*100).toFixed(0)}% exceeds ${(limits.max_primitive_ratio*100).toFixed(0)}%`);
  if(kind==='character'){
    for(const id of profile.character_required_groups??[])if(!group(svg,id))fail('character missing group '+id);
    for(const [left,right] of profile.bilateral_curve_groups??[]){const l=pathD(group(svg,left)),r=pathD(group(svg,right));if(!l.length||!r.length)fail(`BILATERAL limb groups ${left}/${right} need paths`);if(!l.some(d=>/[QqCcSsTt]/u.test(d))||!r.some(d=>/[QqCcSsTt]/u.test(d)))fail(`BILATERAL limb rhythm ${left}/${right} must use independently curved paths`);if(JSON.stringify(l)===JSON.stringify(r))fail(`BILATERAL limb geometry ${left}/${right} is duplicated`);}
  }
  return {kind,curves,primitives,paths,primitive_ratio:ratio};
}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){const p=process.argv[2],kind=process.argv[3]??'focal';if(!p){console.error('Usage: node validate-human-stroke.mjs <asset.svg> [character|focal|support]');process.exit(2);}const svg=await readFile(p,'utf8');const r=validateHumanStroke(svg,kind);console.log(`HUMAN_STROKE_PASS: kind=${r.kind} curves=${r.curves} primitive_ratio=${r.primitive_ratio.toFixed(2)}`);}
