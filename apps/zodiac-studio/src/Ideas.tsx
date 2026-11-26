import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Copy, FolderOpen, Lightbulb, LoaderCircle, RefreshCcw } from "lucide-react";
import { backend, type Project } from "./backend";
import { buildIdeaPrompt, signState, statusFor, type IdeaBoard, type IdeaConcept, type SignState } from "./idea-board";
import { PagedText } from "./Paged";

const STATE_LABEL: Record<SignState, string> = { not_started: "Chưa làm", in_progress: "Đang làm", mp4_approved: "MP4 đã duyệt" };

const STEPS = ["Chọn concept", "Chọn cung", "Copy prompt tổng (hoặc theo cung), dán vào ChatGPT", "Nhập ZIP đã duyệt ở tab Episode"];

/**
 * One screen for planning: concepts on the left with progress, the 12 signs of the chosen concept on the right.
 * A sign that already has an imported episode shows "Mở episode" instead of asking to start again.
 */
export default function Ideas({ projects, selectedProjectId, onOpenProject, onReview }: {
  projects: Project[]; selectedProjectId: string | null; onOpenProject: (projectId: string) => void; onReview: (conceptId: string) => void;
  mode?: "ideas" | "progress";
}) {
  const [board, setBoard] = useState<IdeaBoard | null>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [promptFor, setPromptFor] = useState<{ sign: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try { setBoard(await backend.ideas()); setNotice(null); }
    catch (e) { setNotice({ text: e instanceof Error ? e.message : "Không đọc được thư viện concept.", error: true }); }
  }
  useEffect(() => {
    void load();
    const refresh = () => { void load(); };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  const byKey = useMemo(() => {
    const map = new Map<string, Project>();
    for (const project of projects) if (project.concept_code && project.sign) map.set(`${project.concept_code}|${project.sign}`, project);
    return map;
  }, [projects]);
  const all = useMemo(() => board?.groups.flatMap((g) => g.concepts.map((c) => ({ ...c, group: g.title }))) ?? [], [board]);
  const currentProject = projects.find((p) => p.project_id === selectedProjectId);
  const concept: IdeaConcept | undefined = all.find((c) => c.id === (picked ?? currentProject?.concept_code ?? "")) ?? all[0];
  const doneCount = (c: IdeaConcept) => board ? board.signs.filter((s) => signState(board, c.id, s, byKey.has(`${c.id}|${s}`)) === "mp4_approved").length : 0;
  const startedCount = (c: IdeaConcept) => board ? board.signs.filter((s) => signState(board, c.id, s, byKey.has(`${c.id}|${s}`)) !== "not_started").length : 0;
  const q = query.trim().toLocaleLowerCase("vi");
  const visible = all.filter((c) => !q || (c.title + " " + c.direction).toLocaleLowerCase("vi").includes(q));

  async function copy(sign?: string) {
    if (!board || !concept) return;
    const episodeSigns = board.signs.filter((s) => byKey.has(`${concept.id}|${s}`));
    const text = buildIdeaPrompt(board, concept, sign, episodeSigns);
    const label = sign ?? "concept này (agent tự chọn cung)";
    if (!text) { setNotice({ text: sign ? `${sign} đã có MP4 duyệt cho concept này. Chọn cung khác.` : "Cả 12 cung của concept này đã có MP4 duyệt.", error: false }); return; }
    setBusy(true); setPromptFor(null);
    try {
      await navigator.clipboard.writeText(text);
      setNotice({ text: `Đã copy prompt cho ${label}. Mở ChatGPT, chọn @Zodiac-Video-Web, dán và gửi. Khi có ZIP đã duyệt, nhập ở tab Episode.`, error: false });
    } catch {
      setPromptFor({ sign: label, text });
      setNotice({ text: "Không copy được tự động. Chọn văn bản bên dưới và bấm Ctrl+C.", error: true });
    } finally { setBusy(false); }
  }

  return (
    <section className="plan-workspace" aria-label="Kế hoạch concept">
      <header className="plan-head">
        <h1><Lightbulb size={22} /> Kế hoạch</h1>
        <span className="panel-meta">{board ? `${all.length} concept · mỗi concept làm 12 tập, mỗi cung một tập` : "Đang đọc…"}</span>
        <button className="subtle-btn" onClick={() => void load()} aria-label="Đọc lại"><RefreshCcw size={14} /> Làm mới</button>
      </header>
      <ol className="plan-steps" aria-label="Các bước">{STEPS.map((text, index) => <li key={text}><span>{index + 1}</span>{text}</li>)}</ol>
      {notice && <div role={notice.error ? "alert" : "status"} className={"inline-alert " + (notice.error ? "error" : "success")}>{notice.text}</div>}
      {!board ? <p className="panel-meta"><LoaderCircle size={14} className="spin" /> Đang đọc thư viện concept…</p> : (
        <div className="plan-body">
          <aside className="plan-list panel" aria-label="Danh sách concept">
            <input aria-label="Tìm concept" value={query} maxLength={120} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm concept…" />
            {board.groups.map((group) => {
              const rows = visible.filter((c) => c.group === group.title);
              if (!rows.length) return null;
              return (
                <div key={group.id} className="plan-group"><h2>{group.title}</h2>
                  {rows.map((c) => (
                    <button key={c.id} className="plan-concept" aria-pressed={concept?.id === c.id} onClick={() => { setPicked(c.id); setPromptFor(null); }}>
                      <strong>{c.title}</strong>
                      <span className="plan-bar" aria-hidden="true"><i style={{ width: `${(startedCount(c) / 12) * 100}%` }} /></span>
                      <small>{doneCount(c)}/12 xong · {startedCount(c)}/12 đã bắt đầu</small>
                    </button>))}
                </div>);
            })}
            {!visible.length && <p className="panel-meta">Không có concept phù hợp.</p>}
          </aside>
          {concept && (
            <section className="plan-detail panel" aria-label="Chi tiết concept">
              <h2>{concept.title}</h2>
              <p>{concept.direction}</p>
              <div className="plan-signs" role="list">{board.signs.map((sign) => {
                const project = byKey.get(`${concept.id}|${sign}`);
                const state = signState(board, concept.id, sign, !!project);
                return (
                  <div key={sign} role="listitem" className={"plan-sign " + state} data-sign={sign}>
                    <span className="plan-sign-name">{state === "mp4_approved" ? <CheckCircle2 size={16} /> : <Circle size={16} />}<strong>{sign}</strong></span>
                    <small>{STATE_LABEL[state]}{statusFor(board, concept.id, sign) === "not_started" && project ? " · đã nhập gói" : ""}</small>
                    {project
                      ? <button className="primary-btn" onClick={() => onOpenProject(project.project_id)}><FolderOpen size={13} /> Mở episode</button>
                      : <button className="outline-btn" disabled={busy || state === "mp4_approved"} onClick={() => void copy(sign)}><Copy size={13} /> Copy prompt cung này</button>}
                  </div>);
              })}</div>
              <div className="plan-actions"><button className="primary-btn" disabled={busy} onClick={() => void copy()}><Copy size={13} /> Copy prompt tổng (agent tự chọn cung)</button> <button className="subtle-btn" onClick={() => onReview(concept.id)}>Xem & duyệt MP4 của concept này</button></div>
              {promptFor && <div className="idea-prompt"><strong>Prompt cho {promptFor.sign}</strong><PagedText key={promptFor.sign} text={promptFor.text} label="Prompt cho agent" /></div>}
            </section>)}
        </div>)}
    </section>
  );
}
