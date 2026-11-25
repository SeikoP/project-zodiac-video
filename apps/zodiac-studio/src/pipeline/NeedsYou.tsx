import { useSyncExternalStore } from "react";
import type { PipelineStore } from "./pipeline-store";

/** The only list that asks for the person: gates, plus blocked or failed steps with their issues. */
export default function NeedsYou({ store, onOpen }: { store: PipelineStore; onOpen: (nodeId: string) => void }) {
  const { needsYou } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  if (needsYou.length === 0) return null; // the next-action bar already says "nothing needed"
  return (
    <section className="needs-you" aria-label="Cần bạn xử lý">
      <h2>Cần bạn</h2>
      {needsYou.length === 0
        ? <p className="needs-empty">Không cần bạn lúc này</p>
        : <ul>{needsYou.map((item) => (
          <li key={item.node_id + item.kind} data-kind={item.kind}>
            <strong>{item.title}</strong>
            {item.detail && <p>{item.detail}</p>}
            {item.issues.length > 0 && <ul className="needs-issues">{item.issues.slice(0, 8).map((issue, index) => (
              <li key={issue.code + index}><code>{issue.code}</code>{issue.scene_id ? ` [${issue.scene_id}]` : ""} {issue.message}</li>))}</ul>}
            <button className="outline-btn" onClick={() => onOpen(item.node_id)}>{item.kind === "gate" ? "Xem và duyệt" : "Mở"}</button>
          </li>))}</ul>}
    </section>
  );
}
