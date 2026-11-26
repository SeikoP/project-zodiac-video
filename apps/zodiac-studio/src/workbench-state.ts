export type WorkbenchSelection = {
  projectId: string;
  sceneId: string | null;
  entityId: string | null;
  timeMs: number;
  stateId?: string | null;
  eventId?: string | null;
  anchorId?: string | null;
};

export type GraphStage = 'content' | 'voice' | 'visual' | 'export';
export type GraphTarget = { stage: GraphStage; sceneId?: string; entityId?: string; stateId?: string; eventId?: string; anchorId?: string; unitId?: string; timeMs?: number };
