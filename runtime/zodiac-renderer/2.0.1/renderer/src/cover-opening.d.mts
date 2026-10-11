import type {CoverPublish, RenderPlanScene} from './types';
export type CoverOpening = {duration_frames:number;transition_frames:number};
export function resolveCoverOpening(publish:CoverPublish|undefined|null,fps:number,scenes:RenderPlanScene[]):CoverOpening|null;
export function coverOpeningOpacity(opening:CoverOpening|null,frame:number):number;
