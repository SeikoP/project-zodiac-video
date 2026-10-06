import type {Performance, ProductionScene} from "./types";
export function validatePerformanceAnimation(scene: ProductionScene): void;
export function validatePerformanceTiming(scene: ProductionScene, resolvedEvents: Record<string, number>): void;
export function performanceMotionValues(frame: number, motionDuration: number, performance: Performance, focusDirection?: number): {x:number;y:number;rotate_deg:number;scale:number;opacity:number};
