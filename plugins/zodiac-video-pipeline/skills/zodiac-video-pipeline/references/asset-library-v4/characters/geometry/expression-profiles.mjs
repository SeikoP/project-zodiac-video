// Friendly face grammar v2: filled soft-dot eyes and small, readable mouths.
// Never draw almond-shaped empty/slit eyes or angular diamond mouths.
const dotEye=(x,y,rx=7,ry=9)=>`M${x} ${y-ry} C${x+rx} ${y-ry} ${x+rx} ${y+ry} ${x} ${y+ry} C${x-rx} ${y+ry} ${x-rx} ${y-ry} ${x} ${y-ry}Z`;
const smileEye=(x,y)=>`M${x-12} ${y-2} Q${x} ${y+9} ${x+12} ${y-2}`;
const ink=d=>`<path d="${d}" fill="none" stroke="#2F3C44" stroke-width="7" stroke-linecap="round"/>`;
const blush=ink('M177 323 L184 339 M187 321 L194 337 M337 323 L344 339 M348 321 L355 336');
// Separate performed faces keep ordinary dialogue calm and give meme reactions real contrast.
const memeFaces={
 'meme-panic':{eye_mode:'dot',eyes:[dotEye(204,283,8,10),dotEye(322,281,8,11)],mouth:'M240 352 C243 337 284 334 296 353 C306 375 292 397 270 398 C248 398 233 375 240 352Z',mouth_fill:'#2F3C44',details:ink('M175 247 Q199 228 228 243 M297 239 Q323 222 350 243')+'<path d="M366 255 Q354 276 365 283 Q380 278 366 255Z" fill="#8EC0B9" stroke="#2F3C44" stroke-width="4.5"/>',eye_backdrop:'M204 250 C238 248 240 316 205 317 C172 317 172 251 204 250Z M322 247 C356 245 358 314 324 316 C290 317 289 248 322 247Z'},
 'meme-smug':{eye_mode:'closed',eyes:['M178 282 Q202 265 228 280','M296 277 Q323 264 347 273'],mouth:'M218 340 Q270 369 325 324 Q312 386 259 387 Q228 382 218 340Z',mouth_fill:'#FFFDF9',details:ink('M175 248 Q200 230 227 245 M295 236 Q324 219 351 238 M232 354 Q273 374 312 344')},
 'meme-deadpan':{eye_mode:'dot',eyes:[dotEye(205,290,6,5),dotEye(322,284,8,6)],mouth:'M218 369 Q258 362 313 364 L323 375',details:ink('M176 259 L231 263 M297 253 Q326 241 350 251 M249 235 L261 249 M269 234 L278 247')},
 'meme-side-eye':{eye_mode:'dot',eyes:[dotEye(223,286,8,9),dotEye(339,283,8,9)],mouth:'M226 371 Q266 368 313 350',details:ink('M178 263 Q202 250 230 262 M295 252 Q322 239 348 250 M177 302 Q204 310 232 301 M295 299 Q321 307 350 295')},
 'meme-cringe':{eye_mode:'closed',eyes:['M180 288 Q198 277 218 290','M308 290 Q327 277 345 288'],mouth:'M229 368 Q247 356 266 365 Q287 354 307 367 L302 384 Q266 377 233 384Z',mouth_fill:'#FFFDF9',details:ink('M177 251 Q201 241 230 254 M295 254 Q321 239 350 250')},
 'meme-grimace':{eye_mode:'closed',eyes:['M178 293 Q202 267 228 292','M297 291 Q323 263 349 291'],mouth:'M231 356 Q267 350 305 357 L300 380 Q267 387 236 379Z',mouth_fill:'#FFFDF9',details:blush+ink('M237 368 L300 368 M178 254 Q201 245 227 255 M297 253 Q322 243 349 252')+'<path d="M366 262 Q356 280 366 285 Q377 280 366 262Z" fill="#8EC0B9" stroke="#2F3C44" stroke-width="4.5"/>'},
 'meme-sob':{eye_mode:'closed',eyes:['M176 282 Q204 260 229 287','M296 285 Q322 257 351 280'],mouth:'M237 378 Q247 352 267 354 Q290 352 301 380 Q268 370 237 378Z',mouth_fill:'#2F3C44',details:ink('M174 244 Q199 262 229 236 M296 237 Q321 259 352 240')+'<path d="M192 294 Q200 298 208 293 L212 358 Q201 372 192 358Z M318 293 Q326 297 334 292 L338 357 Q328 370 319 357Z" fill="#8EC0B9" stroke="#2F3C44" stroke-width="4.5"/>'},
 'meme-drained':{eye_mode:'closed',eyes:['M177 285 Q201 297 230 283','M295 285 Q322 299 350 283'],mouth:'M238 377 Q260 362 288 377 Q271 395 246 388',details:ink('M176 310 Q202 320 229 309 M294 310 Q321 322 351 309 M178 254 Q201 245 230 255 M296 254 Q322 245 351 256')},
 'meme-confused':{eye_mode:'dot',eyes:[dotEye(202,289,6,7),dotEye(326,275,12,14)],mouth:'M241 368 Q258 346 285 359 Q297 373 278 385',details:ink('M173 258 Q199 270 230 253 M296 233 Q327 214 354 241 M250 235 Q260 228 270 238')}
};
export const expr=(id)=>memeFaces[id]??({
 neutral:{eye_mode:'dot',eyes:[dotEye(205,285),dotEye(320,285)],mouth:'M252 357 Q266 369 280 357'},
 deadpan:{eye_mode:'dot',eyes:[dotEye(205,286,7,8),dotEye(320,286,7,8)],mouth:'M255 362 Q267 360 278 362'},
 panic:{eye_mode:'dot',eyes:[dotEye(205,284,8,10),dotEye(320,284,8,10)],mouth:'M260 357 Q268 346 275 357 Q278 370 268 373 Q258 370 260 357Z'},
 smug:{eye_mode:'dot',eyes:[dotEye(207,286,7,8),dotEye(320,285,7,8)],mouth:'M251 357 Q266 369 285 352'},
 'side-eye':{eye_mode:'dot',eyes:[dotEye(212,285,7,9),dotEye(327,285,7,9)],mouth:'M253 358 Q267 361 280 356'},
 relieved:{eye_mode:'closed',eyes:[smileEye(205,286),smileEye(320,286)],mouth:'M250 354 Q267 375 284 354'},
 cry:{eye_mode:'closed',eyes:[smileEye(205,285),smileEye(320,285)],mouth:'M254 369 Q267 351 280 369'},
 exasperated:{eye_mode:'dot',eyes:[dotEye(205,288,7,7),dotEye(320,288,7,7)],mouth:'M255 364 Q267 355 279 364'},
 weary:{eye_mode:'closed',eyes:['M193 285 Q205 295 217 284','M307 286 Q320 298 333 285'],mouth:'M255 372 Q266 358 279 371'},
 embarrassed:{eye_mode:'closed',eyes:[smileEye(205,286),smileEye(320,286)],mouth:'M257 358 Q267 368 277 358'}
}[id]);
