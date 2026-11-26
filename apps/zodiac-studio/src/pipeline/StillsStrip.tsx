import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { backend } from "../backend";
import type { PipelineStore } from "./pipeline-store";
import { cardView } from "./status";

/** One tile per scene. The preview loads only when the tile scrolls into view; clicking opens that scene in the editor. */
function Tile({ projectId, buildId, nodeId, sceneId, status, onOpen }: {
  projectId: string; buildId: string | null; nodeId: string; sceneId: string; status: string; onOpen: (id: string) => void;
}) {
  const box = useRef<HTMLButtonElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!buildId || status !== "DONE" || !box.current) return;
    let live = true;
    const watch = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      watch.disconnect();
      backend.visualPreview(projectId, sceneId, buildId).then((p) => { if (live) setUrl(p.url); }).catch(() => undefined);
    });
    watch.observe(box.current);
    return () => { live = false; watch.disconnect(); };
  }, [projectId, buildId, sceneId, status]);
  return (
    <button ref={box} className="still-tile" data-scene-id={sceneId} data-status={status} onClick={() => onOpen(nodeId)} aria-label={`Cảnh ${sceneId}, mở trong trình chỉnh`}>
      {url
        ? <iframe src={url} title={`Khung ${sceneId}`} tabIndex={-1} aria-hidden="true" loading="lazy" sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" />
        : <span className="still-wait">{status === "DONE" ? "…" : "chưa dựng"}</span>}
      <small>{sceneId}</small>
    </button>
  );
}

export default function StillsStrip({ store, projectId, onOpen }: { store: PipelineStore; projectId: string; onOpen: (nodeId: string) => void }) {
  const { nodes, buildId, cards } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const scenes = nodes.filter((n) => n.id.startsWith("scene:"));
  return (
    <div className="stills">
      {scenes.length > 0 && (
        <div className="stills-strip" role="list" aria-label="Khung hình từng cảnh">
          {scenes.map((n) => <div role="listitem" key={n.id}><Tile projectId={projectId} buildId={buildId} nodeId={n.id} sceneId={n.scene_id ?? n.id} status={n.status} onOpen={onOpen} /></div>)}
        </div>)}
      {cards.map((card) => {
        const view = cardView(card);
        return (
          <section className="owner-card" key={view.sceneId + view.reason} data-scene-id={view.sceneId} aria-label={`Câu hỏi cho cảnh ${view.sceneId}`}>
            <p><strong>Cảnh {view.sceneId}</strong> {view.reason}</p>
            <div className="owner-card-options">
              {view.options.map((o) => (
                <button key={o.id} className="outline-btn" data-option={o.id} data-default={o.isDefault ? "true" : undefined}
                  onClick={() => { void store.resolveCard(view.sceneId, o.id); }}>{o.label}{o.isDefault ? " · mặc định" : ""}</button>))}
            </div>
          </section>);
      })}
    </div>
  );
}
