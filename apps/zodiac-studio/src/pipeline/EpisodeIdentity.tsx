import { useEffect, useState } from "react";
import { backend, type Project } from "../backend";
import { conceptById, type IdeaBoard } from "../idea-board";

let cached: Promise<IdeaBoard> | null = null;
const loadBoard = () => (cached ??= backend.ideas().catch((error) => { cached = null; throw error; }));

/** Says which concept and sign the opened package belongs to, taken from the approved handoff (not guessed). */
export default function EpisodeIdentity({ project, onPlan, onImport }: { project: Project; onPlan: () => void; onImport?: () => void }) {
  const [board, setBoard] = useState<IdeaBoard | null>(null);
  useEffect(() => {
    let live = true;
    void loadBoard().then((b) => { if (live) setBoard(b); }).catch(() => undefined);
    return () => { live = false; };
  }, []);
  const concept = conceptById(board, project.concept_code);
  return (
    <div className="episode-identity" aria-label="Gói đang mở thuộc concept nào">
      <div><small>Concept</small><strong>{concept?.title ?? project.concept_code ?? "Chưa ghi trong gói"}</strong>{concept && <code>{project.concept_code}</code>}</div>
      <div><small>Cung</small><strong>{project.sign ?? "Chưa ghi trong gói"}</strong></div>
      <div className="episode-identity-title"><small>Tập</small><strong>{project.display_title}</strong></div>
      {project.concept_code && <button className="text-link" onClick={onPlan}>Xem trong Kế hoạch</button>}
      {onImport && <button className="text-link" onClick={onImport}>Nhập episode khác</button>}
    </div>
  );
}
