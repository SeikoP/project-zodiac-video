import { useEffect, useState } from "react";
import { backend } from "../../backend";
import type { PipelineEvidence } from "../types";

/** Reads agent evidence (validation report, inspect report, cover, publish copy); refetches when `key` changes. */
export function useEvidence(projectId: string | undefined, key: string) {
  const [evidence, setEvidence] = useState<PipelineEvidence | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!projectId) return undefined;
    let live = true;
    backend.pipelineEvidence(projectId).then((value) => { if (live) { setEvidence(value); setError(""); } },
      (reason: unknown) => { if (live) setError(reason instanceof Error ? reason.message : String(reason)); });
    return () => { live = false; };
  }, [projectId, key]);
  return { evidence, error };
}
