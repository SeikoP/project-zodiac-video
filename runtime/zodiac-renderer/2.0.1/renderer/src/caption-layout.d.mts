import type {RenderPlanScene,RenderPlanPresentation,RenderBox} from './types';
export function resolveCaptionZone(scene:RenderPlanScene,presentation?:RenderPlanPresentation,video?:{width:number;height:number}):RenderBox & {padding:number;fontSize:number;lineHeight:number;maxLines:number;source:string};
