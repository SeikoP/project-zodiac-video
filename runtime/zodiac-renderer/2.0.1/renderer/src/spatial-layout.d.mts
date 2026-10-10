import type {CoverPublish,RenderPlanScene,RenderPlanAsset,RenderPlanEntity,RenderPlanState,RenderTransform,RenderBox} from './types';
export function resolveCoverVisuals(visuals:NonNullable<CoverPublish['cover']>['visuals'],scene:RenderPlanScene,assets:Record<string,RenderPlanAsset>,region:{width:number;height:number}):Array<{visual:NonNullable<CoverPublish['cover']>['visuals'][number];entity:RenderPlanEntity;state:RenderPlanState;transform:RenderTransform;src:string;box:RenderBox;order:number;role:string}>;

export function resolveEntityState(scene:RenderPlanScene,entity:RenderPlanEntity,frame:number):RenderPlanState|undefined;

export function resolveDisplayedEntityState(scene:RenderPlanScene,entity:RenderPlanEntity,frame:number):RenderPlanState|undefined;
