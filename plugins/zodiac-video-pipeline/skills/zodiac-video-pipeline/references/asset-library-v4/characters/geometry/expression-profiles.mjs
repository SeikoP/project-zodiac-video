// Friendly face grammar v3: filled soft-dot eyes and small, readable mouths.
// Never draw almond-shaped empty/slit eyes or angular diamond mouths.
const dotEye=(x,y,rx=7,ry=9)=>`M${x} ${y-ry} C${x+rx} ${y-ry} ${x+rx} ${y+ry} ${x} ${y+ry} C${x-rx} ${y+ry} ${x-rx} ${y-ry} ${x} ${y-ry}Z`;
const smileEye=(x,y)=>`M${x-12} ${y-2} Q${x} ${y+9} ${x+12} ${y-2}`;
const ink=d=>`<path d="${d}" fill="none" stroke="#2F3C44" stroke-width="7" stroke-linecap="round"/>`;
const blush=ink('M177 323 L184 339 M187 321 L194 337 M337 323 L344 339 M348 321 L355 336');
// Meme contrast comes from brows, gaze and timing; keep mouths compact and the cast affectionate.
const memeFaces={
 'meme-panic':{eye_mode:'dot',eyes:[dotEye(205,282,8,11),dotEye(320,282,8,11)],mouth:'M254 354 C254 340 280 340 281 355 C283 374 253 375 254 354Z',mouth_fill:'#2F3C44',details:ink('M185 256 Q201 245 222 253 M303 253 Q321 245 339 256')},
 'meme-smug':{eye_mode:'closed',eyes:[smileEye(205,286),smileEye(320,286)],mouth:'M240 354 Q266 384 298 350',details:ink('M187 255 Q203 247 220 253 M305 251 Q322 243 339 250')+blush},
 'meme-deadpan':{eye_mode:'dot',eyes:[dotEye(209,287,7,8),dotEye(324,287,7,8)],mouth:'M243 360 Q267 364 291 359',details:ink('M185 259 Q205 256 224 260 M303 252 Q321 244 341 251')},
 'meme-side-eye':{eye_mode:'dot',eyes:[dotEye(213,285,7,9),dotEye(328,285,7,9)],mouth:'M244 355 Q267 372 293 352',details:ink('M185 258 Q203 250 223 256 M304 253 Q322 244 342 251')},
 'meme-cringe':{eye_mode:'closed',eyes:[smileEye(205,286),'M308 283 Q320 288 332 280'],mouth:'M241 359 Q265 380 292 356',details:blush+ink('M186 256 Q204 249 223 256 M304 254 Q322 247 340 253')},
 'meme-grimace':{eye_mode:'dot',eyes:[dotEye(205,286,7,8),dotEye(320,284,7,8)],mouth:'M240 354 Q267 350 294 354 L291 374 Q267 379 243 373Z',mouth_fill:'#FFFDF9',details:blush+ink('M245 363 L289 363 M185 255 Q204 248 223 255 M303 253 Q321 246 340 252')},
 'meme-sob':{eye_mode:'closed',eyes:[smileEye(205,285),smileEye(320,285)],mouth:'M243 370 Q266 348 291 370',details:ink('M186 253 Q204 261 223 252 M304 252 Q322 260 341 252')+'<path d="M199 302 Q187 322 199 327 Q211 322 199 302Z M326 302 Q314 322 326 327 Q338 322 326 302Z" fill="#8EC0B9" stroke="#2F3C44" stroke-width="4.5"/>'},
 'meme-drained':{eye_mode:'closed',eyes:['M193 285 Q205 291 217 285','M308 285 Q320 292 332 285'],mouth:'M244 364 Q267 355 291 364',details:ink('M186 259 Q204 254 223 258 M304 258 Q322 254 340 259')},
 'meme-confused':{eye_mode:'dot',eyes:[dotEye(205,287,7,9),dotEye(320,283,8,10)],mouth:'M250 357 Q267 349 280 360 Q285 373 267 374',details:ink('M186 258 Q203 263 223 256 M303 248 Q321 238 341 248')}
};
export const expr=(id)=>memeFaces[id]??({
 neutral:{eye_mode:'dot',eyes:[dotEye(205,285),dotEye(320,285)],mouth:'M252 357 Q266 369 280 357'},
 deadpan:{eye_mode:'dot',eyes:[dotEye(205,286,7,8),dotEye(320,286,7,8)],mouth:'M255 362 Q267 360 278 362'},
 panic:{eye_mode:'dot',eyes:[dotEye(205,283,9,12),dotEye(320,283,9,12)],mouth:'M260 357 Q268 346 275 357 Q278 370 268 373 Q258 370 260 357Z'},
 smug:{eye_mode:'dot',eyes:[dotEye(207,286,7,8),dotEye(320,285,7,8)],mouth:'M251 357 Q266 369 285 352'},
 'side-eye':{eye_mode:'dot',eyes:[dotEye(212,285,7,9),dotEye(327,285,7,9)],mouth:'M253 358 Q267 361 280 356'},
 relieved:{eye_mode:'closed',eyes:[smileEye(205,286),smileEye(320,286)],mouth:'M250 354 Q267 375 284 354'},
 cry:{eye_mode:'closed',eyes:[smileEye(205,285),smileEye(320,285)],mouth:'M254 369 Q267 351 280 369'},
 exasperated:{eye_mode:'dot',eyes:[dotEye(205,288,7,7),dotEye(320,288,7,7)],mouth:'M255 364 Q267 355 279 364'},
 weary:{eye_mode:'closed',eyes:['M193 285 Q205 295 217 284','M307 286 Q320 298 333 285'],mouth:'M255 372 Q266 358 279 371'},
 embarrassed:{eye_mode:'closed',eyes:[smileEye(205,286),smileEye(320,286)],mouth:'M257 358 Q267 368 277 358'}
}[id]);
