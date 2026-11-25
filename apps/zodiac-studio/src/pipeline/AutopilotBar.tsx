import { useEffect, useState, useSyncExternalStore } from "react";
import { Play, Square } from "lucide-react";
import type { PipelineStore } from "./pipeline-store";

const STATE_LABEL: Record<string, string> = {
  IDLE: "Chưa chạy", RUNNING: "Đang chạy", WAITING_GATE: "Chờ bạn duyệt", WAITING_USER: "Chờ bạn xử lý", DONE: "Hoàn tất", STOPPED: "Đã dừng",
};

function useElapsed(running: boolean, node: string | null) {
  const [since, setSince] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { setSince(Date.now()); setNow(Date.now()); }, [node, running]);
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);
  return Math.max(0, Math.floor((now - since) / 1000));
}

export default function AutopilotBar({ store }: { store: PipelineStore }) {
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const state = snap.run?.state ?? "IDLE";
  const running = state === "RUNNING";
  const current = snap.nodes.find((n) => n.id === snap.run?.node);
  const seconds = useElapsed(running, snap.run?.node ?? null);
  const autopilot = snap.mode === "autopilot";
  return (
    <div className="autopilot-bar" role="toolbar" aria-label="Chạy tự động">
      {running
        ? <button className="outline-btn" onClick={() => void store.stopAutopilot()}><Square size={13} aria-hidden="true" /> Dừng</button>
        : <button className="primary-btn" disabled={!autopilot} title={autopilot ? undefined : "Chuyển sang chế độ Tự động để chạy"}
            onClick={() => void store.startAutopilot()}><Play size={13} aria-hidden="true" /> Chạy tự động</button>}
      <button role="switch" aria-checked={autopilot} className="outline-btn pipe-mode"
        onClick={() => void store.setMode(autopilot ? "confirm" : "autopilot")}>
        {autopilot ? "Chế độ: Tự động" : "Chế độ: Từng bước"}<small> · đổi sang {autopilot ? "Từng bước" : "Tự động"}</small>
      </button>
      <span className="pipe-run-state" aria-live="polite">
        {STATE_LABEL[state] ?? state}
        {running && current ? ` · ${current.title} · ${seconds}s` : ""}
      </span>
      {!autopilot && !running && <span className="pipe-hint">Từng bước: bạn bấm Chạy ở mỗi thẻ. Đổi sang Tự động để máy chạy cả chuỗi.</span>}
      {snap.error && <span className="pipe-error" role="alert">{snap.error}</span>}
    </div>
  );
}
