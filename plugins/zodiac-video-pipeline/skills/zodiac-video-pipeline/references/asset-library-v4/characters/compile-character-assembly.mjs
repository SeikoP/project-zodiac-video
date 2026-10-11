#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateCharacterDesignIntent} from './character-design-intent.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const catalog=JSON.parse(await readFile(path.join(here,'components/catalog.json'),'utf8'));
const fail=m=>{throw new Error('CHARACTER_ASSEMBLY_INVALID: '+m);};
const ids=(key)=>new Set((catalog[key]??[]).map(x=>x.id));
const bodyIds=ids('body_profiles'),hairIds=ids('hair'),outfitIds=ids('outfits'),expressionIds=ids('expressions'),poseIds=ids('poses'),cropIds=ids('crops'),faceProfileIds=ids('face_profiles'),accessoryIds=ids('accessories');
const bodyById=new Map(catalog.body_profiles.map(x=>[x.id,x]));
const faceProfileById=new Map((catalog.face_profiles??[]).map(x=>[x.id,x]));
const cropById=new Map((catalog.crops??[]).map(x=>[x.id,x]));
const shirtColors=catalog.shirt_colors??[];
const shirtColorsById=new Map(shirtColors.map(x=>[x.id,x]));
const escapeXml=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const hash32=s=>{let h=2166136261;for(const c of String(s)){h^=c.codePointAt(0);h=Math.imul(h,16777619)>>>0;}return h>>>0;};
const defaultShirtColorId=identity=>{
 if(!shirtColors.length)fail('catalog shirt_colors is required');
 const seed=identity?.variant_seed??identity?.entity_id??'';
 return shirtColors[hash32(`${seed}|${identity?.outfit_id??''}|shirt-color`)%shirtColors.length].id;
};
const resolveShirtColorId=identity=>{
 const id=identity?.shirt_color_id??defaultShirtColorId(identity);
 if(!shirtColorsById.has(id))fail('unknown shirt color '+id);
 return id;
};
const resolveShirtColor=identity=>shirtColorsById.get(resolveShirtColorId(identity));
export const identitySignature=identity=>createHash('sha256').update([identity.entity_id,identity.body_profile,identity.hair_id,identity.face_profile_id??'balanced',identity.outfit_id,resolveShirtColorId(identity),identity.accessory_id??'none',identity.variant_seed??''].join('|')).digest('hex').slice(0,16);
export function resolveShirtColorAssignments(production,plan){
 const specs=plan?.characters??[];
 if(!shirtColors.length)fail('catalog shirt_colors is required');
 const byId=new Map();
 for(const spec of specs){
  if(!spec?.entity_id)fail('character entity_id required for shirt color assignment');
  if(byId.has(spec.entity_id))fail('duplicate character plan '+spec.entity_id);
  byId.set(spec.entity_id,spec);
 }
 const neighbors=new Map(specs.map(spec=>[spec.entity_id,new Set()]));
 for(const scene of production?.scenes??[]){
  const visible=[...new Set((scene.entities??[]).filter(e=>e.kind==='character'&&Object.values(e.states??{}).some(state=>state?.visible!==false)).map(e=>e.id).filter(id=>byId.has(id)))];
  for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++){
   neighbors.get(visible[i]).add(visible[j]);neighbors.get(visible[j]).add(visible[i]);
  }
 }
 const assignments=new Map();
 for(const spec of specs)if(spec.shirt_color_id!==undefined){
  assignments.set(spec.entity_id,resolveShirtColorId({...spec,variant_seed:spec.variant_seed??spec.entity_id}));
 }
 for(const spec of specs)if(spec.shirt_color_id!==undefined){
  for(const other of neighbors.get(spec.entity_id)??[])if(assignments.get(other)===assignments.get(spec.entity_id))fail(`visible characters ${spec.entity_id} and ${other} share shirt_color_id ${spec.shirt_color_id}`);
 }
 const automatic=specs.filter(spec=>spec.shirt_color_id===undefined).slice().sort((a,b)=>a.entity_id<b.entity_id?-1:a.entity_id>b.entity_id?1:0);
 for(const spec of automatic){
  const preferred=defaultShirtColorId({...spec,variant_seed:spec.variant_seed??spec.entity_id});
  const start=shirtColors.findIndex(color=>color.id===preferred);
  const order=[...shirtColors.slice(start),...shirtColors.slice(0,start)].map(color=>color.id);
  const used=new Set([...(neighbors.get(spec.entity_id)??[])].map(id=>assignments.get(id)).filter(Boolean));
  assignments.set(spec.entity_id,order.find(id=>!used.has(id))??preferred);
 }
 return assignments;
}
const BODY={
 standard_compact:{head:'M119 311 Q123 202 214 164 Q301 130 381 195 Q432 239 426 331 Q420 414 346 456 Q260 500 187 447 Q122 403 119 311Z',inner:'M148 312 Q145 231 220 201 Q291 174 350 221 Q398 260 392 325 Q386 393 329 428 Q267 463 209 423 Q149 386 148 312Z',torso:'M169 473 Q218 448 305 460 Q355 468 379 496 Q376 548 369 622 Q330 654 266 656 Q190 653 146 616 Q141 557 143 515 Q146 487 169 473Z',shoulderL:[174,520],shoulderR:[360,522],hipL:[225,648],hipR:[307,649]},
 round_soft:{head:'M103 309 Q111 191 207 151 Q309 116 399 191 Q447 235 439 336 Q427 430 344 472 Q252 514 166 459 Q96 409 103 309Z',inner:'M137 311 Q139 220 218 188 Q302 157 370 217 Q413 259 405 332 Q398 407 331 441 Q254 477 190 435 Q136 395 137 311Z',torso:'M137 478 Q205 439 316 452 Q390 459 411 503 Q407 570 391 635 Q335 674 258 674 Q169 671 116 625 Q103 565 111 514 Q116 489 137 478Z',shoulderL:[145,522],shoulderR:[388,525],hipL:[217,665],hipR:[317,666]},
 lean_tall:{head:'M139 301 Q147 196 224 160 Q300 126 372 185 Q415 227 409 320 Q402 401 336 442 Q263 484 198 438 Q137 395 139 301Z',inner:'M164 302 Q165 225 229 196 Q293 169 349 215 Q384 249 378 317 Q373 380 319 414 Q263 447 211 411 Q164 377 164 302Z',torso:'M190 465 Q223 446 298 452 Q337 458 357 485 Q354 548 349 643 Q321 671 269 673 Q211 670 179 640 Q173 554 176 497 Q178 476 190 465Z',shoulderL:[193,515],shoulderR:[351,517],hipL:[230,662],hipR:[305,663]},
 stocky_short:{head:'M111 321 Q118 209 211 169 Q302 136 387 202 Q432 245 426 337 Q416 421 343 459 Q259 499 181 451 Q109 407 111 321Z',inner:'M144 319 Q146 235 218 205 Q294 180 357 228 Q394 262 388 331 Q382 398 326 428 Q259 460 202 424 Q144 388 144 319Z',torso:'M126 488 Q204 451 326 466 Q402 478 421 514 Q416 577 400 627 Q341 653 263 654 Q176 650 111 616 Q104 561 108 523 Q109 500 126 488Z',shoulderL:[137,528],shoulderR:[404,530],hipL:[211,646],hipR:[325,647]},
 petite_compact:{head:'M143 322 Q149 220 225 184 Q301 150 370 208 Q408 245 402 333 Q394 407 332 444 Q264 481 203 442 Q144 404 143 322Z',inner:'M170 321 Q170 245 233 217 Q293 190 345 232 Q377 263 372 329 Q367 386 318 416 Q265 445 217 415 Q170 384 170 321Z',torso:'M184 478 Q222 456 300 464 Q342 470 360 498 Q355 552 348 615 Q319 641 269 642 Q212 639 177 613 Q171 552 172 507 Q173 489 184 478Z',shoulderL:[188,518],shoulderR:[354,520],hipL:[228,634],hipR:[307,635]},
 lanky_slouch:{head:'M137 308 Q145 203 222 166 Q296 132 369 188 Q414 230 410 319 Q403 398 337 439 Q265 480 199 437 Q137 395 137 308Z',inner:'M163 308 Q164 229 229 199 Q291 173 347 216 Q382 249 378 315 Q373 377 320 411 Q264 444 211 408 Q163 375 163 308Z',torso:'M181 469 Q222 448 300 457 Q342 464 363 491 Q361 549 353 648 Q319 673 268 675 Q211 671 173 636 Q166 558 168 505 Q168 481 181 469Z',shoulderL:[184,515],shoulderR:[357,520],hipL:[225,664],hipR:[306,666]}
};
for(const [profileId,geometry] of Object.entries(BODY))geometry.profile_id=profileId;
const hairPaths=(id)=>({
 'asym-bang':['M147 248 Q165 179 225 152 Q294 126 359 164 Q401 186 410 244 Q353 213 302 210 Q249 206 197 232 Q168 244 147 248Z','M198 177 Q245 145 302 160 Q262 176 229 217 Q214 235 203 255Z'],
 'lopsided-bob':['M146 248 Q165 177 227 151 Q298 126 361 168 Q407 196 411 258 Q385 232 357 223 Q371 285 350 361 Q329 337 309 313 Q283 340 242 354 Q205 340 181 310 Q167 336 151 359 Q134 302 146 248Z'],
 'spiky-overthink':['M145 253 Q167 184 225 155 L242 122 Q263 145 278 125 Q296 149 320 126 L330 159 Q386 177 409 245 Q362 218 319 210 Q258 197 199 226 Q167 240 145 253Z'],
 'antenna-short':['M151 250 Q171 184 229 158 Q296 132 356 171 Q399 197 407 249 Q365 219 319 211 Q261 199 204 225 Q173 238 151 250Z','M271 154 Q257 113 271 84 Q289 110 284 154'],
 'blocky-cut':['M143 256 Q153 184 217 153 Q297 122 373 166 Q414 193 419 254 Q380 224 337 215 L326 185 Q280 204 233 211 L207 184 Q176 211 143 256Z'],
 'soft-wave':['M145 252 Q164 178 227 150 Q298 123 365 167 Q409 194 413 252 Q382 220 350 219 Q366 248 350 277 Q330 252 311 239 Q293 266 269 277 Q250 249 231 240 Q209 264 182 276 Q163 250 145 252Z'],
 'side-part':['M147 250 Q165 181 225 153 Q294 126 361 166 Q405 193 410 249 Q368 217 322 208 Q283 196 254 205 Q231 214 205 236 Q177 244 147 250Z','M255 204 Q286 165 333 171 Q308 186 286 223Z'],
 'clean-bun':['M148 249 Q162 181 224 152 Q291 125 358 165 Q405 192 408 249 Q371 214 325 205 Q264 190 202 219 Q171 233 148 249Z','M241 111 Q252 79 285 78 Q316 82 331 108 Q343 131 333 151 Q318 175 290 173 Q263 176 246 151 Q231 132 241 111Z'],
 'high-ponytail':['M148 250 Q164 181 226 153 Q295 127 359 167 Q403 193 409 249 Q370 216 323 207 Q262 194 202 220 Q171 235 148 250Z','M340 160 Q403 130 429 178 Q439 218 397 243 Q419 185 340 160Z'],
 'twin-tail':['M149 250 Q164 182 225 154 Q294 128 359 168 Q403 194 409 250 Q370 217 323 208 Q263 195 203 221 Q172 235 149 250Z','M160 207 Q111 192 91 231 Q89 272 129 290 Q116 241 160 207Z','M374 207 Q422 190 445 229 Q449 269 410 291 Q419 243 374 207Z']
}[id]);
// Friendly face grammar v2: filled soft-dot eyes and small, readable mouths.
// Never draw almond-shaped empty/slit eyes or angular diamond mouths.
const dotEye=(x,y,rx=7,ry=9)=>`M${x} ${y-ry} C${x+rx} ${y-ry} ${x+rx} ${y+ry} ${x} ${y+ry} C${x-rx} ${y+ry} ${x-rx} ${y-ry} ${x} ${y-ry}Z`;
const smileEye=(x,y)=>`M${x-12} ${y-2} Q${x} ${y+9} ${x+12} ${y-2}`;
const expr=(id)=>({
 neutral:{eye_mode:'dot',eyes:[dotEye(205,285),dotEye(320,285)],mouth:'M252 357 Q266 369 280 357'},
 deadpan:{eye_mode:'dot',eyes:[dotEye(205,286,7,8),dotEye(320,286,7,8)],mouth:'M255 362 Q267 360 278 362'},
 panic:{eye_mode:'dot',eyes:[dotEye(205,283,9,12),dotEye(320,283,9,12)],mouth:'M260 357 Q268 346 275 357 Q278 370 268 373 Q258 370 260 357Z'},
 smug:{eye_mode:'dot',eyes:[dotEye(207,286,7,8),dotEye(320,285,7,8)],mouth:'M251 357 Q266 369 285 352'},
 'side-eye':{eye_mode:'dot',eyes:[dotEye(212,285,7,9),dotEye(327,285,7,9)],mouth:'M253 358 Q267 361 280 356'},
 relieved:{eye_mode:'closed',eyes:[smileEye(205,286),smileEye(320,286)],mouth:'M250 354 Q267 375 284 354'},
 cry:{eye_mode:'closed',eyes:[smileEye(205,285),smileEye(320,285)],mouth:'M254 369 Q267 351 280 369'},
 exasperated:{eye_mode:'dot',eyes:[dotEye(205,288,7,7),dotEye(320,288,7,7)],mouth:'M255 364 Q267 355 279 364'},
 embarrassed:{eye_mode:'closed',eyes:[smileEye(205,286),smileEye(320,286)],mouth:'M257 358 Q267 368 277 358'}
}[id]);
const posePaths=(id,b)=>{const [lx,ly]=b.shoulderL,[rx,ry]=b.shoulderR,[hlx,hly]=b.hipL,[hrx,hry]=b.hipR;const p={
 rest_sitting:{la:`M${lx} ${ly} Q${lx-22} ${ly+55} ${hlx-20} ${hly-4}`,ra:`M${rx} ${ry} Q${rx+24} ${ry+55} ${hrx+25} ${hry-5}`,ll:`M${hlx} ${hly} Q${hlx-46} ${hly+18} ${hlx-66} ${hly+22} Q${hlx-80} ${hly+63} ${hlx-62} ${hly+104} Q${hlx-54} ${hly+111} ${hlx-38} ${hly+105}`,rl:`M${hrx} ${hry} Q${hrx+43} ${hry+15} ${hrx+63} ${hry+24} Q${hrx+75} ${hry+65} ${hrx+57} ${hry+104} Q${hrx+67} ${hry+112} ${hrx+86} ${hry+107}`},
 rest_lying:{la:`M${lx} ${ly} Q${lx+15} ${ly+42} 400 485`,ra:`M${rx} ${ry} Q${rx+40} ${ry+42} 455 470`,ll:`M${hlx} ${hly} Q${hlx+105} ${hly+16} 695 493 Q742 497 784 480`,rl:`M${hrx} ${hry} Q${hrx+106} ${hry+15} 720 531 Q771 543 814 529`},
 neutral:{la:`M${lx} ${ly} Q${lx-28} ${ly+24} ${lx-53} ${ly+72} Q${lx-61} ${ly+86} ${lx-65} ${ly+92}`,ra:`M${rx} ${ry} Q${rx+27} ${ry+25} ${rx+49} ${ry+69} Q${rx+58} ${ry+82} ${rx+62} ${ry+91}`,ll:`M${hlx} ${hly} Q${hlx-5} ${hly+28} ${hlx-12} 705 Q${hlx-18} 712 ${hlx-24} 714`,rl:`M${hrx} ${hry} Q${hrx+6} ${hry+29} ${hrx+14} 704 Q${hrx+20} 711 ${hrx+27} 714`},
 explain:{la:`M${lx} ${ly} Q${lx-45} ${ly+5} ${lx-89} ${ly+25} Q${lx-106} ${ly+34} ${lx-119} ${ly+19}`,ra:`M${rx} ${ry} Q${rx+39} ${ry+13} ${rx+71} ${ry+50} Q${rx+82} ${ry+64} ${rx+96} ${ry+54}`,ll:`M${hlx} ${hly} Q${hlx-4} ${hly+30} ${hlx-10} 705 Q${hlx-16} 711 ${hlx-22} 714`,rl:`M${hrx} ${hry} Q${hrx+7} ${hry+27} ${hrx+15} 704 Q${hrx+20} 710 ${hrx+27} 714`},
 reach:{la:`M${lx} ${ly} Q${lx-28} ${ly+25} ${lx-54} ${ly+73} Q${lx-61} ${ly+86} ${lx-66} ${ly+92}`,ra:`M${rx} ${ry} Q${rx+39} ${ry-4} ${rx+83} ${ry+9} Q${Math.min(rx+112,516)} ${ry+17} ${Math.min(rx+116,500)} ${ry+3}`,ll:`M${hlx} ${hly} Q${hlx-5} ${hly+28} ${hlx-12} 705 Q${hlx-18} 712 ${hlx-24} 714`,rl:`M${hrx} ${hry} Q${hrx+6} ${hry+29} ${hrx+14} 704 Q${hrx+20} 711 ${hrx+27} 714`},
 offer:{la:`M${lx} ${ly} Q${lx-22} ${ly+31} 226 588 Q242 602 258 589`,ra:`M${rx} ${ry} Q${rx+21} ${ry+31} 313 589 Q296 604 277 589`,ll:`M${hlx} ${hly} Q${hlx-5} ${hly+28} ${hlx-12} 705 Q${hlx-18} 712 ${hlx-24} 714`,rl:`M${hrx} ${hry} Q${hrx+6} ${hry+29} ${hrx+14} 704 Q${hrx+20} 711 ${hrx+27} 714`},
 confront:{la:`M${lx} ${ly} Q${lx-48} ${ly+20} ${lx-88} ${ly+3} Q${lx-101} ${ly-4} ${lx-113} ${ly+5}`,ra:`M${rx} ${ry} Q${rx+46} ${ry+17} ${rx+86} ${ry-1} Q${Math.min(rx+101,505)} ${ry-7} ${Math.min(rx+96,500)} ${ry+3}`,ll:`M${hlx} ${hly} Q${hlx-11} ${hly+29} ${hlx-24} 704 Q${hlx-31} 711 ${hlx-38} 714`,rl:`M${hrx} ${hry} Q${hrx+12} ${hry+27} ${hrx+28} 703 Q${hrx+36} 710 ${hrx+43} 714`},
 run:{la:`M${lx} ${ly} Q${lx-52} ${ly+5} ${lx-82} ${ly+45} Q${lx-93} ${ly+57} ${lx-106} ${ly+48}`,ra:`M${rx} ${ry} Q${rx+48} ${ry+3} ${rx+78} ${ry-36} Q${Math.min(rx+88,492)} ${ry-48} ${Math.min(rx+88,498)} ${ry-42}`,ll:`M${hlx} ${hly} Q${hlx-34} ${hly+30} ${hlx-73} 689 Q${hlx-93} 697 ${hlx-111} 690`,rl:`M${hrx} ${hry} Q${hrx+35} ${hry+22} ${hrx+66} 692 Q${hrx+87} 701 ${hrx+103} 711`},
 'scratch-head':{la:`M${lx} ${ly} Q${lx-30} ${ly+25} ${lx-51} ${ly+71} Q${lx-58} ${ly+84} ${lx-64} ${ly+91}`,ra:`M${rx} ${ry} Q${rx+36} ${ry-14} ${rx+15} 432 Q${rx-4} 395 ${rx-25} 368`,ll:`M${hlx} ${hly} Q${hlx-5} ${hly+28} ${hlx-12} 705 Q${hlx-18} 712 ${hlx-24} 714`,rl:`M${hrx} ${hry} Q${hrx+6} ${hry+29} ${hrx+14} 704 Q${hrx+20} 711 ${hrx+27} 714`},
 'raise-evidence':{la:`M${lx} ${ly} Q${lx-29} ${ly+23} ${lx-53} ${ly+72} Q${lx-60} ${ly+84} ${lx-65} ${ly+91}`,ra:`M${rx} ${ry} Q${rx+24} ${ry-30} ${rx+43} 458 Q${rx+51} 437 ${rx+45} 415`,ll:`M${hlx} ${hly} Q${hlx-5} ${hly+28} ${hlx-12} 705 Q${hlx-18} 712 ${hlx-24} 714`,rl:`M${hrx} ${hry} Q${hrx+6} ${hry+29} ${hrx+14} 704 Q${hrx+20} 711 ${hrx+27} 714`},
 facepalm:{la:`M${lx} ${ly} Q${lx-30} ${ly+25} ${lx-52} ${ly+70} Q${lx-59} ${ly+84} ${lx-65} ${ly+92}`,ra:`M${rx} ${ry} Q${rx+12} ${ry-95} 354 355 Q330 322 300 295`,ll:`M${hlx} ${hly} Q${hlx-5} ${hly+28} ${hlx-12} 705 Q${hlx-18} 712 ${hlx-24} 714`,rl:`M${hrx} ${hry} Q${hrx+6} ${hry+29} ${hrx+14} 704 Q${hrx+20} 711 ${hrx+27} 714`},
 'cry-hug':{la:`M${lx} ${ly} Q${lx+20} ${ly+55} 253 566 Q239 553 220 520`,ra:`M${rx} ${ry} Q${rx-20} ${ry+55} 267 565 Q284 548 300 520`,ll:`M${hlx} ${hly} Q${hlx-5} ${hly+28} ${hlx-12} 705 Q${hlx-18} 712 ${hlx-24} 714`,rl:`M${hrx} ${hry} Q${hrx+6} ${hry+29} ${hrx+14} 704 Q${hrx+20} 711 ${hrx+27} 714`},
 'offer-pants':{la:`M${lx} ${ly} Q${lx-22} ${ly-48} 226 354 Q218 365 220 380`,ra:`M${rx} ${ry} Q${rx+22} ${ry-48} 294 354 Q302 365 300 380`,ll:`M${hlx} ${hly} Q${hlx-5} ${hly+28} ${hlx-12} 705 Q${hlx-18} 712 ${hlx-24} 714`,rl:`M${hrx} ${hry} Q${hrx+6} ${hry+29} ${hrx+14} 704 Q${hrx+20} 711 ${hrx+27} 714`},
 'receive-pants':{la:`M${lx} ${ly} Q${lx-42} ${ly-28} ${Math.max(75,lx-76)} 405 Q82 391 75 370`,ra:`M${rx} ${ry} Q${rx+24} ${ry+32} ${rx+42} 420 Q${rx+51} 432 ${rx+61} 440`,ll:`M${hlx} ${hly} Q${hlx-5} ${hly+28} ${hlx-12} 705 Q${hlx-18} 712 ${hlx-24} 714`,rl:`M${hrx} ${hry} Q${hrx+6} ${hry+29} ${hrx+14} 704 Q${hrx+20} 711 ${hrx+27} 714`},
 recoil:{la:`M${lx} ${ly} Q${lx-38} ${ly-75} 145 420 Q128 408 115 405`,ra:`M${rx} ${ry} Q${rx+38} ${ry-75} 375 420 Q392 408 405 405`,ll:`M${hlx} ${hly} Q${hlx-24} ${hly+20} ${hlx-54} 690 Q${hlx-72} 696 ${hlx-89} 690`,rl:`M${hrx} ${hry} Q${hrx+24} ${hry+20} ${hrx+54} 690 Q${hrx+72} 696 ${hrx+89} 690`},
 'inspect-prop':{la:`M${lx} ${ly} Q${lx-28} ${ly+24} ${lx-53} ${ly+72} Q${lx-60} ${ly+85} ${lx-65} ${ly+92}`,ra:`M${rx} ${ry} Q${rx+42} ${ry-10} ${Math.min(rx+80,500)} 435 Q${Math.min(rx+92,508)} 445 ${Math.min(rx+100,510)} 455`,ll:`M${hlx} ${hly} Q${hlx-5} ${hly+28} ${hlx-12} 705 Q${hlx-18} 712 ${hlx-24} 714`,rl:`M${hrx} ${hry} Q${hrx+6} ${hry+29} ${hrx+14} 704 Q${hrx+20} 711 ${hrx+27} 714`},
 'flex-prop':{la:`M${lx} ${ly} Q${lx-28} ${ly+40} ${lx+10} 458 Q${lx+22} 450 ${lx+25} 440`,ra:`M${rx} ${ry} Q${rx+36} ${ry-42} ${Math.min(rx+40,490)} 430 Q${Math.min(rx+44,494)} 423 ${Math.min(rx+45,495)} 420`,ll:`M${hlx} ${hly} Q${hlx-5} ${hly+28} ${hlx-12} 705 Q${hlx-18} 712 ${hlx-24} 714`,rl:`M${hrx} ${hry} Q${hrx+6} ${hry+29} ${hrx+14} 704 Q${hrx+20} 711 ${hrx+27} 714`},
 write:{la:`M${lx} ${ly} Q${lx-25} ${ly+30} ${lx-53} ${ly+74} Q${lx-60} ${ly+87} ${lx-65} ${ly+92}`,ra:`M${rx} ${ry} Q${rx+8} ${ry+18} ${rx-4} 500 Q${rx-14} 533 ${rx-24} 558`,ll:`M${hlx} ${hly} Q${hlx-5} ${hly+28} ${hlx-12} 705 Q${hlx-18} 712 ${hlx-24} 714`,rl:`M${hrx} ${hry} Q${hrx+6} ${hry+29} ${hrx+14} 704 Q${hrx+20} 711 ${hrx+27} 714`},
 read:{la:`M${lx} ${ly} Q${lx+5} ${ly+27} 224 486 Q230 505 243 520`,ra:`M${rx} ${ry} Q${rx-4} ${ry+28} 302 486 Q296 507 281 520`,ll:`M${hlx} ${hly} Q${hlx-5} ${hly+28} ${hlx-12} 705 Q${hlx-18} 712 ${hlx-24} 714`,rl:`M${hrx} ${hry} Q${hrx+6} ${hry+29} ${hrx+14} 704 Q${hrx+20} 711 ${hrx+27} 714`},
 'carry-backpack':{la:`M${lx} ${ly} Q${lx-18} ${ly-26} ${lx-23} 447 Q${lx-18} 425 ${lx-8} 414`,ra:`M${rx} ${ry} Q${rx+21} ${ry-21} ${rx+23} 445 Q${rx+16} 425 ${rx+5} 414`,ll:`M${hlx} ${hly} Q${hlx-5} ${hly+28} ${hlx-12} 705 Q${hlx-18} 712 ${hlx-24} 714`,rl:`M${hrx} ${hry} Q${hrx+6} ${hry+29} ${hrx+14} 704 Q${hrx+20} 711 ${hrx+27} 714`},
 'text-phone':{la:`M${lx} ${ly} Q${lx+9} ${ly+25} 225 478 Q230 500 246 520`,ra:`M${rx} ${ry} Q${rx-8} ${ry+26} 304 479 Q297 501 278 520`,ll:`M${hlx} ${hly} Q${hlx-5} ${hly+28} ${hlx-12} 705 Q${hlx-18} 712 ${hlx-24} 714`,rl:`M${hrx} ${hry} Q${hrx+6} ${hry+29} ${hrx+14} 704 Q${hrx+20} 711 ${hrx+27} 714`}
 };
 // Per-profile authored leg geometry: do not scale the entire sticker.
 // Preserve hip joints while changing knee/ankle/foot reach across every pose.
 const footOffsets={standard_compact:0,round_soft:-9,lean_tall:31,stocky_short:-35,petite_compact:-42,lanky_slouch:25};
 const offset=footOffsets[b.profile_id??'standard_compact']??0;
 const ret=p[id];
 if(ret&&offset!==0){
  for(const side of ['ll','rl']) ret[side]=ret[side].replace(/\b(689|690|692|696|697|701|703|704|705|710|711|712|714)\b/g,n=>String(Number(n)+offset));
 }
 return ret;};

const handPoints=(id,b)=>{const [lx,ly]=b.shoulderL,[rx,ry]=b.shoulderR;return ({
 rest_sitting:[[b.hipL[0]-20,b.hipL[1]-4],[b.hipR[0]+25,b.hipR[1]-5]],
 rest_lying:[[400,485],[455,470]],
 neutral:[[lx-65,ly+92],[rx+62,ry+91]],
 explain:[[lx-119,ly+19],[rx+96,ry+54]],
 reach:[[lx-66,ly+92],[Math.min(rx+116,500),ry+3]],
 offer:[[258,589],[277,589]],
 confront:[[lx-113,ly+5],[Math.min(rx+96,500),ry+3]],
 run:[[lx-106,ly+48],[Math.min(rx+88,498),ry-42]],
 'scratch-head':[[lx-64,ly+91],[rx-25,368]],
 'raise-evidence':[[lx-65,ly+91],[rx+45,415]],
 facepalm:[[lx-65,ly+92],[300,295]],
 'cry-hug':[[220,520],[300,520]],
 'offer-pants':[[220,380],[300,380]],
 'receive-pants':[[75,370],[rx+61,440]],
 recoil:[[115,405],[405,405]],
 'inspect-prop':[[lx-65,ly+92],[Math.min(rx+100,510),455]],
 'flex-prop':[[lx+25,440],[Math.min(rx+45,495),420]],
 write:[[lx-65,ly+92],[rx-24,558]],
 read:[[243,520],[281,520]],
 'carry-backpack':[[lx-8,414],[rx+5,414]],
 'text-phone':[[246,520],[278,520]]
 })[id];};
const handShape=([x,y],side)=>side==='left'?`M${x-9} ${y} Q${x-3} ${y-11} ${x+7} ${y-4} Q${x+12} ${y+6} ${x+2} ${y+11} Q${x-8} ${y+9} ${x-9} ${y}Z`:`M${x-8} ${y-3} Q${x+1} ${y-11} ${x+10} ${y-1} Q${x+9} ${y+9} ${x-2} ${y+11} Q${x-11} ${y+5} ${x-8} ${y-3}Z`;

const outfitMarkup=(outfitId,seed)=>{const h=hash32(seed+'|'+outfitId),accent=h%3,alt=(h>>>5)%3;const key=outfitId.startsWith('generic-')?outfitId:outfitId.split('-')[0];const core={aries:'M247 520 Q266 495 286 520 M247 520 Q236 541 248 555 M286 520 Q298 541 286 555',taurus:'M244 520 Q266 500 289 520 Q286 551 266 559 Q246 552 244 520 M250 504 Q238 493 237 479 M283 504 Q296 493 297 478',gemini:'M248 493 Q266 501 286 493 M248 556 Q266 548 286 556 M254 502 Q252 528 254 548 M281 502 Q283 528 281 548',cancer:'M243 521 Q256 507 273 516 Q283 527 272 538 Q258 548 244 537 M291 536 Q278 550 262 541 Q251 530 262 519 Q276 509 290 520',leo:'M247 540 Q241 516 256 505 Q276 491 290 510 Q303 530 285 548 Q271 561 251 551',virgo:'M246 502 Q252 530 255 557 M266 503 Q271 531 272 555 M285 503 Q286 531 286 553 Q298 544 301 531',libra:'M244 543 Q266 528 289 543 M249 520 Q267 499 285 520 Q267 535 249 520',scorpio:'M246 502 Q252 530 255 557 M266 503 Q271 531 272 555 M286 503 Q287 531 288 554 Q300 545 302 531 M300 531 Q307 535 310 543',sagittarius:'M245 552 Q268 526 295 499 M275 500 Q295 499 295 519 M274 523 Q292 523 301 533',capricorn:'M245 536 Q254 503 271 516 Q281 525 274 544 Q286 519 301 528 Q310 539 300 552',aquarius:'M241 520 Q255 510 269 520 Q283 530 297 519 M241 543 Q255 533 269 543 Q283 553 297 542',pisces:'M247 503 Q263 521 247 553 M287 503 Q271 521 287 553 M250 528 Q267 521 284 528','generic-cosmic-light':'M244 522 Q258 506 270 521 Q282 505 294 522 Q282 538 270 526 Q258 540 244 522','generic-soft-stripes':'M238 507 Q265 494 296 508 M238 530 Q266 516 298 531 M239 553 Q266 539 296 554','generic-doodle-dots':'M245 515 Q252 505 261 515 Q258 527 248 525 M275 535 Q283 524 292 535 Q288 546 279 544 M249 558 Q257 548 266 558 Q263 569 253 568','generic-wave-stitch':'M238 516 Q251 504 264 516 Q277 528 290 515 M240 545 Q253 533 266 545 Q279 557 293 544','generic-check-spark':'M242 506 Q257 521 272 505 M242 523 Q257 508 272 524 M287 542 Q296 528 305 542 Q297 553 287 542'}[key]??'M246 520 Q267 500 290 520 Q267 541 246 520';const accentPaths=['M208 510 Q218 503 228 511','M306 535 Q316 527 326 536','M222 576 Q234 568 246 577'];const secondPaths=['M310 495 Q319 490 327 499','M205 548 Q214 541 224 551','M293 577 Q304 569 315 578'];return `<g id="outfit_decoration"><path d="${core}" fill="none" stroke="#FFFDF9" stroke-width="6" stroke-linecap="round"/><path d="${accentPaths[accent]}" fill="none" stroke="#F2C45C" stroke-width="5" stroke-linecap="round"/><path d="${secondPaths[alt]}" fill="none" stroke="#E97A66" stroke-width="5" stroke-linecap="round"/></g>`;};
const validate=(identity,state)=>{if(!identity?.entity_id)fail('entity_id required');if(!bodyIds.has(identity.body_profile))fail('unknown body '+identity.body_profile);if(!hairIds.has(identity.hair_id))fail('unknown hair '+identity.hair_id);if(!outfitIds.has(identity.outfit_id))fail('unknown outfit '+identity.outfit_id);if(!faceProfileIds.has(identity.face_profile_id??'balanced'))fail('unknown face profile '+identity.face_profile_id);if(identity.accessory_id&&identity.accessory_id!=='none'&&!accessoryIds.has(identity.accessory_id))fail('unknown accessory '+identity.accessory_id);if(identity.shirt_color_id!==undefined&&!shirtColorsById.has(identity.shirt_color_id))fail('unknown shirt color '+identity.shirt_color_id);if(!poseIds.has(state?.pose_id))fail('unknown pose '+state?.pose_id);if(!expressionIds.has(state?.expression_id))fail('unknown expression '+state?.expression_id);if(state?.crop_id&&!cropIds.has(state.crop_id))fail('unknown crop '+state.crop_id);};
const accessoryMarkup=id=>id==='round-glasses'?'<g id="accessory_glasses"><path d="M171 277 Q176 259 199 260 Q226 262 230 283 Q228 305 204 309 Q179 307 171 277Z M292 280 Q297 259 321 260 Q346 262 351 281 Q349 305 324 309 Q300 307 292 280Z" fill="none" stroke="#2F3C44" stroke-width="6"/><path d="M230 278 Q259 267 292 279 M169 272 Q157 265 146 270 M353 273 Q367 265 378 271" fill="none" stroke="#2F3C44" stroke-width="5.5" stroke-linecap="round"/></g>':id==='star-hair-clip'?'<g id="accessory_hair_clip"><path d="M186 185 Q196 167 207 184 L227 180 Q232 199 216 208 L219 226 Q199 229 191 213 Q174 220 166 203 Q178 190 186 185Z" fill="#F2C45C" stroke="#2F3C44" stroke-width="5" stroke-linejoin="round"/><path d="M177 230 Q197 236 216 226 M187 184 Q188 198 198 207" fill="none" stroke="#FFFDF9" stroke-width="4.5" stroke-linecap="round"/></g>':'';
const transformEyePath=(d,profile)=>{let i=0;return d.replace(/-?\d+(?:\.\d+)?/gu,raw=>{const n=Number(raw),x=i++%2===0;const center=x?261.5:286,scale=x?(profile.eye_scale_x??1):(profile.eye_scale_y??1),offset=x?(profile.eye_offset_x??0):0;return String(Math.round((center+(n-center)*scale+offset)*10)/10);});};
export function compileCharacterSvg(identity,state){validate(identity,state);const shirt=resolveShirtColor(identity),faceId=identity.face_profile_id??'balanced',accessoryId=identity.accessory_id??'none';const faceProfile=faceProfileById.get(faceId),faceMarks=faceProfile.mark_style==='freckles'?'<g id="face_identity_marks"><path d="M194 333 Q198 330 202 333 M207 337 Q211 334 215 337 M310 337 Q314 334 318 337 M323 333 Q327 330 331 333" fill="none" stroke="#E97A66" stroke-width="4.5" stroke-linecap="round"/></g>':'';const b=state.pose_id==='rest_lying'?{...BODY[identity.body_profile],torso:'M282 423 Q324 403 369 412 L571 437 Q594 470 568 504 L346 483 Q302 472 282 423Z',shoulderL:[324,440],shoulderR:[335,415],hipL:[555,480],hipR:[570,454]}:BODY[identity.body_profile],e=expr(state.expression_id),facePaths=e.eyes.map(d=>transformEyePath(d,faceProfile)),p=posePaths(state.pose_id,b),hands=handPoints(state.pose_id,b),slot=['offer','offer-pants','cry-hug','read','text-phone'].includes(state.pose_id)?[(hands[0][0]+hands[1][0])/2,(hands[0][1]+hands[1][1])/2]:hands[1],sig=identitySignature(identity),hair=hairPaths(identity.hair_id),source=bodyById.get(identity.body_profile).source_master,crop=cropById.get(state.crop_id),viewBox=crop?crop.view_box.join(' '):state.pose_id==='rest_lying'?'0 0 900 760':'0 0 520 760';const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><metadata>asset_role=character_master;id=assembled-${escapeXml(identity.entity_id)};style=zodiac-paper-doodle-meme-v4;handmade=human-stroke-v2;character_assembly=v1;body_profile=${identity.body_profile};body_geometry=authored-limb-reach-v2;hair_id=${identity.hair_id};face_profile_id=${faceId};accessory_id=${accessoryId};outfit_id=${identity.outfit_id};shirt_color_id=${shirt.id};shirt_color=${shirt.hex};identity_signature=${sig};crop_id=${state.crop_id??'none'};production_safe=true</metadata><g id="sticker_edge"><path d="${b.head}" fill="#FFFDF9" stroke="#FFFDF9" stroke-width="18"/><path d="${hair[0]}" fill="#FFFDF9" stroke="#FFFDF9" stroke-width="16"/>${hair.slice(1).map(d=>`<path d="${d}" fill="#FFFDF9" stroke="#FFFDF9" stroke-width="16"/>`).join('')}<path d="${b.torso}" fill="#FFFDF9" stroke="#FFFDF9" stroke-width="20"/><path d="${p.la}" fill="none" stroke="#FFFDF9" stroke-width="22" stroke-linecap="round"/><path d="${p.ra}" fill="none" stroke="#FFFDF9" stroke-width="22" stroke-linecap="round"/><path d="${handShape(hands[0],'left')}" fill="#FFFDF9" stroke="#FFFDF9" stroke-width="15"/><path d="${handShape(hands[1],'right')}" fill="#FFFDF9" stroke="#FFFDF9" stroke-width="15"/><path d="${p.ll}" fill="none" stroke="#FFFDF9" stroke-width="22" stroke-linecap="round"/><path d="${p.rl}" fill="none" stroke="#FFFDF9" stroke-width="22" stroke-linecap="round"/></g>${state.pose_id==='rest_lying'?'':'<g id="shadow"><path d="M171 688 Q257 706 357 687 Q322 699 274 699" fill="none" stroke="#D0C1B3" stroke-width="8" stroke-linecap="round"/></g>'}<g id="head_outline"><path d="${b.head}" fill="#FFFDF9" stroke="#2F3C44" stroke-width="6"/><path d="${b.inner}" fill="#F1C6A0" stroke="#2F3C44" stroke-width="4.5"/></g><g id="hair_back">${hair.map((d,i)=>`<path d="${d}" fill="#4B5B61" stroke="#2F3C44" stroke-width="${i?5:5.5}" stroke-linejoin="round"/>`).join('')}</g>${accessoryId==='star-hair-clip'?accessoryMarkup(accessoryId):''}<g id="face_eyes"><path d="${facePaths[0]}" fill="${e.eye_mode==='dot'?'#2F3C44':'none'}" stroke="${e.eye_mode==='dot'?'none':'#2F3C44'}" stroke-width="5" stroke-linecap="round"/><path d="${facePaths[1]}" fill="${e.eye_mode==='dot'?'#2F3C44':'none'}" stroke="${e.eye_mode==='dot'?'none':'#2F3C44'}" stroke-width="5" stroke-linecap="round"/></g>${state.expression_id==='cry'?'<g id="face_tears"><path d="M192 288 C185 301 185 312 193 316 C202 313 201 301 192 288Z" fill="#8EC0B9" stroke="#2F3C44" stroke-width="4.5"/><path d="M317 288 C310 301 310 312 318 316 C327 313 326 301 317 288Z" fill="#8EC0B9" stroke="#2F3C44" stroke-width="4.5"/></g>':''}<g id="face_mouth"><path d="${e.mouth}" fill="none" stroke="#2F3C44" stroke-width="6" stroke-linecap="round"/></g>${faceMarks}${accessoryId==='round-glasses'?accessoryMarkup(accessoryId):''}<g id="torso"><path d="${b.torso}" fill="${shirt.hex}" stroke="#2F3C44" stroke-width="7"/>${state.pose_id==='rest_lying'?'<defs><clipPath id="lying_outfit_clip"><path d="'+b.torso+'"/></clipPath></defs><g clip-path="url(#lying_outfit_clip)"><g transform="matrix(0 -1 1 0 -130 715)">'+outfitMarkup(identity.outfit_id,identity.variant_seed??identity.entity_id)+'</g></g>':outfitMarkup(identity.outfit_id,identity.variant_seed??identity.entity_id)}</g><g id="left_arm"><path d="${p.la}" fill="none" stroke="#2F3C44" stroke-width="9" stroke-linecap="round"/><path d="${handShape(hands[0],'left')}" fill="#F1C6A0" stroke="#2F3C44" stroke-width="5"/></g><g id="right_arm"><path d="${p.ra}" fill="none" stroke="#2F3C44" stroke-width="10" stroke-linecap="round"/><path d="${handShape(hands[1],'right')}" fill="#F1C6A0" stroke="#2F3C44" stroke-width="5"/></g><g id="left_leg"><path d="${p.ll}" fill="none" stroke="#2F3C44" stroke-width="9" stroke-linecap="round"/></g><g id="right_leg"><path d="${p.rl}" fill="none" stroke="#2F3C44" stroke-width="10" stroke-linecap="round"/></g><g id="prop_slot"><path d="M${slot[0]-5} ${slot[1]} Q${slot[0]} ${slot[1]-6} ${slot[0]+6} ${slot[1]} Q${slot[0]+2} ${slot[1]+6} ${slot[0]-5} ${slot[1]}Z" fill="#E97A66" opacity="0"/></g></svg>`;return {svg,sockets:{left_grip:hands[0],right_grip:hands[1],prop_slot:slot},catalog_integrity:'PASS',episode_contact_review:'PENDING',identity_signature:sig,body_source_master:source,body_profile:identity.body_profile,hair_id:identity.hair_id,face_profile_id:faceId,accessory_id:accessoryId,outfit_id:identity.outfit_id,shirt_color_id:shirt.id,shirt_color:shirt.hex,pose_id:state.pose_id,expression_id:state.expression_id,crop_id:state.crop_id??null};}
const characterIdentity=(spec,resolvedShirtColors)=>({entity_id:spec.entity_id,body_profile:spec.body_profile,hair_id:spec.hair_id,face_profile_id:spec.face_profile_id??'balanced',accessory_id:spec.accessory_id??'none',outfit_id:spec.outfit_id,shirt_color_id:spec.shirt_color_id??resolvedShirtColors.get(spec.entity_id),variant_seed:spec.variant_seed??spec.entity_id});
const stableJson=value=>JSON.stringify(value);
const sha256=value=>createHash('sha256').update(typeof value==='string'?value:stableJson(value),'utf8').digest('hex');
export function planCharacterStateAssets(production,plan){
 if(production?.version!=='2.0')fail('production.version must be 2.0');
 if(!Array.isArray(plan?.characters))fail('plan.characters must be an array');
 validateCharacterDesignIntent(production,plan);
 const sceneMatches=[];
 for(const scene of production.scenes??[])for(const entity of scene.entities??[])if(entity.kind==='character')sceneMatches.push({scene,entity});
 const resolvedShirtColors=resolveShirtColorAssignments(production,plan),seenSpecs=new Set(),assetOwners=new Map(),assetPaths=new Map(),characters=[];
 for(const spec of plan.characters){
  if(seenSpecs.has(spec.entity_id))fail('duplicate character plan '+spec.entity_id);seenSpecs.add(spec.entity_id);
  const matches=sceneMatches.filter(x=>x.entity.id===spec.entity_id);if(!matches.length)fail('unknown character entity '+spec.entity_id);
  const identity=characterIdentity(spec,resolvedShirtColors),stateSpecs=spec.states??{},groupsByKey=new Map();
  for(const {scene,entity} of matches){
   const acting=scene.visual_grammar?.meme_composition?.acting_requirements?.[spec.entity_id]??{};
   for(const stateId of Object.keys(entity.states??{})){
    const state=stateSpecs[stateId];if(!state)fail(`${spec.entity_id} missing assembly state ${stateId}`);
    if(stateId===entity.initial_state)for(const [field,expected] of Object.entries(acting))if(state[field]!==expected)fail(`${scene.id}/${spec.entity_id}/${stateId} meme acting requires ${field}=${expected}, got ${state[field]??'(missing)'}`);
    validate(identity,state);
    const stateKey=stableJson([identitySignature(identity),state.pose_id,state.expression_id,state.crop_id??'']);
    let group=groupsByKey.get(stateKey);
    if(!group){
     const assetKey=sha256(stateKey).slice(0,12),representativeStateId=stateId;
     const assetId=`CHAR_${spec.entity_id}_${representativeStateId}`.replace(/[^A-Za-z0-9_]/gu,'_').toUpperCase();
     const rel=`assets/characters/${spec.entity_id}-${representativeStateId}.svg`;
     const owner=`${spec.entity_id}/${representativeStateId}`;
     if(assetOwners.has(assetId)&&assetOwners.get(assetId)!==owner)fail(`asset id collision ${assetId}: ${assetOwners.get(assetId)} vs ${owner}`);
     if(assetPaths.has(rel)&&assetPaths.get(rel)!==owner)fail(`asset path collision ${rel}: ${assetPaths.get(rel)} vs ${owner}`);
     assetOwners.set(assetId,owner);assetPaths.set(rel,owner);
     group={asset_key:assetKey,asset_id:assetId,path:rel,representative_state_id:representativeStateId,pose_id:state.pose_id,expression_id:state.expression_id,crop_id:state.crop_id??null,state_ids:[]};groupsByKey.set(stateKey,group);
    }
    if(!group.state_ids.includes(stateId))group.state_ids.push(stateId);
   }
  }
  const groups=[...groupsByKey.values()],requestedBudget=spec.asset_budget?.max_unique_states??3;
  if(!Number.isInteger(requestedBudget)||requestedBudget<1||requestedBudget>12)fail(`${spec.entity_id} asset_budget.max_unique_states must be an integer from 1 to 12`);
  if(requestedBudget>3&&(typeof spec.asset_budget?.exception_reason!=='string'||spec.asset_budget.exception_reason.trim().length<12))fail(`${spec.entity_id} asset_budget above 3 requires exception_reason`);
  if(groups.length>requestedBudget)fail(`${spec.entity_id} has ${groups.length} unique character assets; budget is ${requestedBudget}`);
  characters.push({entity_id:spec.entity_id,max_unique_states:requestedBudget,exception_reason:spec.asset_budget?.exception_reason?.trim()??null,unique_asset_count:groups.length,reused_state_count:groups.reduce((n,g)=>n+Math.max(0,g.state_ids.length-1),0),groups});
 }
 const productionStateShape=sceneMatches.map(({scene,entity})=>({scene_id:scene.id,entity_id:entity.id,initial_state:entity.initial_state??null,state_ids:Object.keys(entity.states??{})}));
 return {format:'zodiac-character-state-asset-plan@1',policy:{default_max_unique_states_per_character:3,reuse_key:'identity_signature+pose_id+expression_id+crop_id',svg_content_dedupe:false},source:{production_states_sha256:sha256(productionStateShape),assembly_plan_sha256:sha256(plan)},characters};
}
export async function compileCharacterAssembly(production,plan,{root='.',writeAssets=false,stateAssetPlan}={}){
 const planned=planCharacterStateAssets(production,plan);
 if(stateAssetPlan&&stableJson(stateAssetPlan)!==stableJson(planned))fail('state asset plan is stale; run --plan-only again before --write');
 const out=JSON.parse(JSON.stringify(production));out.assets??={};
 const sceneMatches=[];for(const scene of out.scenes??[])for(const entity of scene.entities??[])if(entity.kind==='character')sceneMatches.push({scene,entity});
 for(const {entity} of sceneMatches){if(entity.visual_role&&entity.visual_role!=='character')fail('ROLE_CONFLICT '+entity.id);entity.visual_role='character';for(const state of Object.values(entity.states??{})){state.layer??=20;state.visible??=true;}}
 const resolvedShirtColors=resolveShirtColorAssignments(production,plan);
 for(const charPlan of planned.characters){
  const spec=plan.characters.find(item=>item.entity_id===charPlan.entity_id),identity=characterIdentity(spec,resolvedShirtColors),matches=sceneMatches.filter(x=>x.entity.id===spec.entity_id);
  for(const group of charPlan.groups){
   const state=spec.states[group.representative_state_id],built=compileCharacterSvg(identity,state),rel=group.path;
   out.assets[group.asset_id]={path:rel,style_id:'zodiac-paper-doodle-meme-v4',category:'character',character_blueprint:{identity_id:spec.identity_id??spec.entity_id,identity_signature:built.identity_signature,body_profile:spec.body_profile,hair_id:spec.hair_id,face_profile_id:built.face_profile_id,accessory_id:built.accessory_id,outfit_id:spec.outfit_id,shirt_color_id:built.shirt_color_id,shirt_color:built.shirt_color,pose_id:state.pose_id,expression_id:state.expression_id,crop_id:state.crop_id??null},lineage:{mode:'composite',source_library:'zodiac-visual-grammar-v4',source_master:built.body_source_master,semantic_intent:`${spec.entity_id} ${group.state_ids.join('|')} ${state.pose_id} ${state.expression_id}`}};
   for(const {entity} of matches)for(const stateId of group.state_ids)if(entity.states?.[stateId])entity.states[stateId].asset=group.asset_id;
   if(writeAssets){const abs=path.resolve(root,rel);await mkdir(path.dirname(abs),{recursive:true});await writeFile(abs,built.svg+'\n');}
  }
 }
 return out;
}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);if(direct){if(process.argv.includes('--write')&&!process.argv.includes('--transaction-stage')){const {runGeneratedCompile}=await import('../../../orchestration/generated-asset-ownership.mjs');const result=await runGeneratedCompile(path.dirname(path.resolve(process.argv[2])),fileURLToPath(import.meta.url),process.argv.slice(2),{compiler_id:'character_write',prune:process.argv.includes('--prune-generated')});process.stdout.write(result.stdout??'');process.exit(0);}const productionPath=process.argv[2],planPath=process.argv[3];if(!productionPath||!planPath){console.error('Usage: node compile-character-assembly.mjs <production.json> <character-assembly-plan.json> [--plan-only|--write]');process.exit(2);}try{const production=JSON.parse(await readFile(productionPath,'utf8')),plan=JSON.parse(await readFile(planPath,'utf8')),root=path.dirname(productionPath),assetPlanPath=path.join(root,'.authoring','character-state-asset-plan.json');if(process.argv.includes('--plan-only')){const assetPlan=planCharacterStateAssets(production,plan);await mkdir(path.dirname(assetPlanPath),{recursive:true});await writeFile(assetPlanPath,JSON.stringify(assetPlan,null,2)+'\n');const total=assetPlan.characters.reduce((n,c)=>n+c.unique_asset_count,0),reused=assetPlan.characters.reduce((n,c)=>n+c.reused_state_count,0);console.log(`CHARACTER_ASSET_PLAN_PASS: characters=${assetPlan.characters.length} unique_assets=${total} reused_states=${reused}`);}else if(process.argv.includes('--write')){let assetPlan;try{assetPlan=JSON.parse(await readFile(assetPlanPath,'utf8'));}catch{fail('state asset plan missing; run --plan-only before --write');}const out=await compileCharacterAssembly(production,plan,{root,writeAssets:true,stateAssetPlan:assetPlan});await writeFile(productionPath,JSON.stringify(out,null,2)+'\n');const total=assetPlan.characters.reduce((n,c)=>n+c.unique_asset_count,0),reused=assetPlan.characters.reduce((n,c)=>n+c.reused_state_count,0);console.log(`CHARACTER_ASSEMBLY_COMPILE_PASS: characters=${plan.characters.length} unique_assets=${total} reused_states=${reused}`);}else{const out=await compileCharacterAssembly(production,plan);console.log(JSON.stringify(out,null,2));}}catch(e){console.error(e.message);process.exit(1);}}
