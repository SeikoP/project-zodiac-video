export declare const overlapRatio:(a:{x:number;y:number;width:number;height:number},b:{x:number;y:number;width:number;height:number})=>number;
export declare const effectiveZIndex:(layer:number,entityIndex:number)=>number;
export declare const sceneStateSnapshots:(scene:any)=>Array<{label:string;nodes:any[]}>;
export declare const validateSceneLayerSafety:(scene:any,options?:{minimumOverlapRatio?:number})=>void;
