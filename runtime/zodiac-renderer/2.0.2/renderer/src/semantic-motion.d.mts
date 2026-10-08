export type SemanticMotion = {dx:number;dy:number;rotate:number;scale:number;opacity:number};
export type ExecutableMotionEvent = {motion:string;start_frame:number;end_frame:number};
export function semanticMotionAtFrame(
  event: ExecutableMotionEvent | undefined,
  frame: number,
  options?: {role?: "character"|"environment"|"effect"|"prop"; entering?:boolean; exiting?:boolean}
): SemanticMotion;
export const SUPPORTED_MOTIONS: readonly string[];
