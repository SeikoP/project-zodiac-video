// Friendly face grammar v2: filled soft-dot eyes and small, readable mouths.
// Never draw almond-shaped empty/slit eyes or angular diamond mouths.
// Never draw strokes under the eyes (bags / dark circles): on a small cartoon face they read as unsettling, not tired.
const dotEye=(x,y,rx=7,ry=9)=>`M${x} ${y-ry} C${x+rx} ${y-ry} ${x+rx} ${y+ry} ${x} ${y+ry} C${x-rx} ${y+ry} ${x-rx} ${y-ry} ${x} ${y-ry}Z`;
const smileEye=(x,y)=>`M${x-12} ${y-2} Q${x} ${y+9} ${x+12} ${y-2}`;
const ink=d=>`<path d="${d}" fill="none" stroke="#2F3C44" stroke-width="7" stroke-linecap="round"/>`;
const blush=ink('M177 323 L184 339 M187 321 L194 337 M337 323 L344 339 M348 321 L355 336');
// Separate performed faces keep ordinary dialogue calm and give meme reactions real contrast.
const memeFaces={
 'meme-panic':{eye_mode:'dot',eyes:[dotEye(204,284,8,11),dotEye(322,282,8,11)],mouth:'M246 356 C250 343 290 343 294 356 C298 372 284 384 270 384 C256 384 242 372 246 356Z',mouth_fill:'#2F3C44',details:ink('M176 250 Q199 236 228 247 M297 243 Q323 229 350 247')+'<path d="M366 262 Q357 278 365 283 Q377 279 366 262Z" fill="#8EC0B9" stroke="#2F3C44" stroke-width="4.5"/>'},
 'meme-smug':{eye_mode:'closed',eyes:['M180 284 Q202 270 227 282','M297 281 Q322 270 346 278'],mouth:'M238 352 Q270 370 302 348 Q294 370 270 372 Q246 370 238 352Z',mouth_fill:'#FFFDF9',details:ink('M177 252 Q200 238 227 249 M296 242 Q323 228 350 244')},
 'meme-deadpan':{eye_mode:'dot',eyes:[dotEye(205,290,6,5),dotEye(322,284,8,6)],mouth:'M218 369 Q258 362 313 364 L323 375',details:ink('M176 259 L231 263 M297 253 Q326 241 350 251 M249 235 L261 249 M269 234 L278 247')},
 'meme-side-eye':{eye_mode:'dot',eyes:[dotEye(223,286,8,9),dotEye(339,283,8,9)],mouth:'M226 371 Q266 368 313 350',details:ink('M178 263 Q202 250 230 262 M295 252 Q322 239 348 250')},
 'meme-cringe':{eye_mode:'closed',eyes:['M180 288 Q198 277 218 290','M308 290 Q327 277 345 288'],mouth:'M229 368 Q247 356 266 365 Q287 354 307 367 L302 384 Q266 377 233 384Z',mouth_fill:'#FFFDF9',details:ink('M177 251 Q201 241 230 254 M295 254 Q321 239 350 250')},
 'meme-grimace':{eye_mode:'closed',eyes:['M180 292 Q202 274 227 291','M298 290 Q322 272 347 290'],mouth:'M238 361 Q268 355 300 361 L296 376 Q268 382 242 376Z',mouth_fill:'#FFFDF9',details:ink('M244 369 L294 369 M178 256 Q201 247 227 257 M297 255 Q322 246 349 254')+'<path d="M366 266 Q358 280 366 284 Q374 280 366 266Z" fill="#8EC0B9" stroke="#2F3C44" stroke-width="4.5"/>'},
 'meme-sob':{eye_mode:'closed',eyes:['M178 286 Q204 270 228 288','M298 288 Q322 268 349 284'],mouth:'M244 380 Q256 362 270 366 Q284 362 296 380 Q270 372 244 380Z',mouth_fill:'#2F3C44',details:ink('M176 252 Q200 264 228 244 M297 245 Q321 262 350 249')+'<path d="M194 296 Q200 299 206 295 L208 336 Q200 346 194 336Z M324 295 Q330 298 336 294 L338 335 Q330 345 324 335Z" fill="#8EC0B9" stroke="#2F3C44" stroke-width="4.5"/>'},
 'meme-drained':{eye_mode:'closed',eyes:['M177 285 Q201 297 230 283','M295 285 Q322 299 350 283'],mouth:'M238 377 Q260 362 288 377 Q271 395 246 388',details:ink('M178 254 Q201 245 230 255 M296 254 Q322 245 351 256')},
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
