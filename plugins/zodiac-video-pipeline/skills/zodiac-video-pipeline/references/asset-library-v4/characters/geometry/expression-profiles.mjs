// Friendly face grammar v2: filled soft-dot eyes and small, readable mouths.
// Never draw almond-shaped empty/slit eyes or angular diamond mouths.
const dotEye=(x,y,rx=7,ry=9)=>`M${x} ${y-ry} C${x+rx} ${y-ry} ${x+rx} ${y+ry} ${x} ${y+ry} C${x-rx} ${y+ry} ${x-rx} ${y-ry} ${x} ${y-ry}Z`;
const smileEye=(x,y)=>`M${x-12} ${y-2} Q${x} ${y+9} ${x+12} ${y-2}`;
const ink=d=>`<path d="${d}" fill="none" stroke="#2F3C44" stroke-width="7" stroke-linecap="round"/>`;
const blush=ink('M177 323 L184 339 M187 321 L194 337 M337 323 L344 339 M348 321 L355 336');
// Separate performed faces keep ordinary dialogue calm and give meme reactions real contrast.
const memeFaces={
 'meme-panic':{eye_mode:'dot',eyes:[dotEye(204,282,10,13),dotEye(322,279,11,14)],mouth:'M237 345 C240 325 286 321 299 346 C314 380 296 418 270 419 C238 419 223 376 237 345Z',mouth_fill:'#2F3C44',details:ink('M173 242 Q199 211 228 237 M297 232 Q323 204 350 237')+'<path d="M366 243 Q347 276 365 285 Q387 280 366 243Z" fill="#8EC0B9" stroke="#2F3C44" stroke-width="4.5"/>',eye_backdrop:'M204 243 C246 240 248 320 205 321 C164 321 165 244 204 243Z M322 239 C362 237 365 318 324 320 C281 322 280 241 322 239Z'},
 'meme-smug':{eye_mode:'closed',eyes:['M178 282 Q202 265 228 280','M296 277 Q323 264 347 273'],mouth:'M218 340 Q270 369 325 324 Q312 386 259 387 Q228 382 218 340Z',mouth_fill:'#FFFDF9',details:ink('M175 248 Q200 230 227 245 M295 236 Q324 219 351 238 M232 354 Q273 374 312 344')},
 'meme-deadpan':{eye_mode:'dot',eyes:[dotEye(205,290,6,5),dotEye(322,284,8,6)],mouth:'M218 369 Q258 362 313 364 L323 375',details:ink('M176 259 L231 263 M297 253 Q326 241 350 251 M249 235 L261 249 M269 234 L278 247')},
 'meme-side-eye':{eye_mode:'dot',eyes:[dotEye(223,286,8,9),dotEye(339,283,8,9)],mouth:'M226 371 Q266 368 313 350',details:ink('M178 263 Q202 250 230 262 M295 252 Q322 239 348 250 M177 302 Q204 310 232 301 M295 299 Q321 307 350 295')},
 'meme-cringe':{eye_mode:'closed',eyes:['M179 273 L216 290 L179 306','M343 273 L307 290 L343 306'],mouth:'M223 369 Q243 345 265 360 Q291 340 311 367 L305 391 Q265 378 229 391Z',mouth_fill:'#FFFDF9',details:ink('M176 245 Q201 233 230 250 M295 250 Q321 231 350 246 M236 374 L297 373')},
 'meme-grimace':{eye_mode:'closed',eyes:['M178 293 Q202 267 228 292','M297 291 Q323 263 349 291'],mouth:'M218 350 Q266 341 316 351 L309 389 Q266 399 225 386Z',mouth_fill:'#FFFDF9',details:blush+ink('M226 368 L309 368 M178 252 Q201 241 227 253 M297 251 Q322 239 349 250')+'<path d="M366 251 Q350 279 366 285 Q382 278 366 251Z" fill="#8EC0B9" stroke="#2F3C44" stroke-width="4.5"/>'},
 'meme-sob':{eye_mode:'closed',eyes:['M176 282 Q204 260 229 287','M296 285 Q322 257 351 280'],mouth:'M224 384 Q236 335 266 338 Q299 336 313 387 Q271 370 224 384Z',mouth_fill:'#2F3C44',details:ink('M174 244 Q199 262 229 236 M296 237 Q321 259 352 240')+'<path d="M187 289 Q198 296 209 288 L216 413 Q203 434 187 414Z M315 288 Q327 295 339 286 L343 412 Q331 431 316 413Z" fill="#8EC0B9" stroke="#2F3C44" stroke-width="4.5"/>'},
 'meme-drained':{eye_mode:'closed',eyes:['M177 285 Q201 297 230 283','M295 285 Q322 299 350 283'],mouth:'M238 377 Q260 362 288 377 Q271 395 246 388',details:ink('M176 310 Q202 320 229 309 M294 310 Q321 322 351 309 M178 254 Q201 245 230 255 M296 254 Q322 245 351 256')},
 'meme-confused':{eye_mode:'dot',eyes:[dotEye(202,289,6,7),dotEye(326,275,12,14)],mouth:'M241 368 Q258 346 285 359 Q297 373 278 385',details:ink('M173 258 Q199 270 230 253 M296 233 Q327 214 354 241 M250 235 Q260 228 270 238')}
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
