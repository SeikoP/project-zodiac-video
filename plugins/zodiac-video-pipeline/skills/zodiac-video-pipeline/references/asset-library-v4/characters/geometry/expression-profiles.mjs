// Friendly face grammar v2: filled soft-dot eyes and small, readable mouths.
// Never draw almond-shaped empty/slit eyes or angular diamond mouths.
const dotEye=(x,y,rx=7,ry=9)=>`M${x} ${y-ry} C${x+rx} ${y-ry} ${x+rx} ${y+ry} ${x} ${y+ry} C${x-rx} ${y+ry} ${x-rx} ${y-ry} ${x} ${y-ry}Z`;
const smileEye=(x,y)=>`M${x-12} ${y-2} Q${x} ${y+9} ${x+12} ${y-2}`;
export const expr=(id)=>({
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
