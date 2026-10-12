export const posePaths=(id,b)=>{const [lx,ly]=b.shoulderL,[rx,ry]=b.shoulderR,[hlx,hly]=b.hipL,[hrx,hry]=b.hipR;const p={
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
 'point-choice':{la:`M${lx} ${ly} Q${lx-42} ${ly+6} ${lx-101} ${ly-8}`,ra:`M${rx} ${ry} Q${rx+42} ${ry+6} ${rx+101} ${ry-8}`,ll:`M${hlx} ${hly} Q${hlx-5} ${hly+28} ${hlx-12} 705`,rl:`M${hrx} ${hry} Q${hrx+6} ${hry+29} ${hrx+14} 704`},
 'receive-object':{la:`M${lx} ${ly} Q${lx-10} ${ly+35} 235 570`,ra:`M${rx} ${ry} Q${rx+8} ${ry+35} 292 570`,ll:`M${hlx} ${hly} Q${hlx-5} ${hly+28} ${hlx-12} 705`,rl:`M${hrx} ${hry} Q${hrx+6} ${hry+29} ${hrx+14} 704`},
 'hold-two-props':{la:`M${lx} ${ly} Q${lx-34} ${ly+20} 190 515`,ra:`M${rx} ${ry} Q${rx+34} ${ry+20} 340 515`,ll:`M${hlx} ${hly} Q${hlx-5} ${hly+28} ${hlx-12} 705`,rl:`M${hrx} ${hry} Q${hrx+6} ${hry+29} ${hrx+14} 704`},
 'open-barrier':{la:`M${lx} ${ly} Q${lx-50} ${ly-20} 140 430`,ra:`M${rx} ${ry} Q${rx+50} ${ry-20} 390 430`,ll:`M${hlx} ${hly} Q${hlx-5} ${hly+28} ${hlx-12} 705`,rl:`M${hrx} ${hry} Q${hrx+6} ${hry+29} ${hrx+14} 704`},
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

export const handPoints=(id,b)=>{const [lx,ly]=b.shoulderL,[rx,ry]=b.shoulderR;return ({
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
 'text-phone':[[246,520],[278,520]],
 'point-choice':[[90,512],[430,512]],
 'receive-object':[[235,570],[292,570]],
 'hold-two-props':[[190,515],[340,515]],
 'open-barrier':[[140,430],[390,430]]
 })[id];};
export const handShape=([x,y],side)=>side==='left'?`M${x-9} ${y} Q${x-3} ${y-11} ${x+7} ${y-4} Q${x+12} ${y+6} ${x+2} ${y+11} Q${x-8} ${y+9} ${x-9} ${y}Z`:`M${x-8} ${y-3} Q${x+1} ${y-11} ${x+10} ${y-1} Q${x+9} ${y+9} ${x-2} ${y+11} Q${x-11} ${y+5} ${x-8} ${y-3}Z`;
