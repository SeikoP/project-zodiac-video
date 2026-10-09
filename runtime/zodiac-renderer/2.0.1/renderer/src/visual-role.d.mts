import type {RenderPlanEntity,RenderPlanAsset,RenderPlanScene,RenderPlanState} from './types';
export function resolveVisualRole(entity:RenderPlanEntity,assets?:Record<string,RenderPlanAsset>):string;
export function resolveLayer(entity:RenderPlanEntity,state:RenderPlanState|undefined,assets:Record<string,RenderPlanAsset>):number;
export function resolveLayerOrder(scene:RenderPlanScene,assets:Record<string,RenderPlanAsset>,states?:Record<string,RenderPlanState|undefined>):RenderPlanEntity[];
