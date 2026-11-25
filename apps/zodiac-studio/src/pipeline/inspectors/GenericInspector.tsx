import type { InspectorProps } from "../inspector-registry";
import { STATUS_LABEL } from "../status";
import type { PipelineEvidence } from "../types";
import { useEvidence } from "./useEvidence";

const ISSUE_TEXT: Record<string, (message: string) => string> = {
  ENVIRONMENT_VISUAL_UNDERDEVELOPED: () => "Bối cảnh còn trống: chưa có nền hoặc đồ vật tạo không gian.",
  FRAME_OCCUPANCY_LOW: (m) => { try { const x = JSON.parse(m); return `Khung hình còn thưa: chiếm ${Math.round(x.ratio * 100)}%, cần ít nhất ${Math.round(x.minimum * 100)}%.`; } catch { return "Khung hình còn thưa."; } },
  PASSIVE_STORYTELLING: () => "Cảnh chỉ đứng yên: chưa có hành động hay phản ứng nào kể chuyện.",
  EXPERIENCE_PROFILE_MISSING: () => "Chưa khai báo kiểu cảnh (experience_profile).",
  STORY_FOCUS_MISSING: () => "Chưa chỉ rõ nhân vật hoặc đồ vật chính của cảnh.",
  SCENE_EXPERIENCE_CRITERION_REVIEW: () => "Cảnh chưa đạt một tiêu chí kể chuyện (thường là nhân vật chưa có hành động rõ).",
  VISUAL_DEPTH_UNDERDEVELOPED: () => "Cảnh còn phẳng: thiếu lớp trước/sau.",
};
const issueText = (issue: { code: string; message: string }) => ISSUE_TEXT[issue.code]?.(issue.message) ?? issue.message;

function Body({ id, evidence }: { id: string; evidence: PipelineEvidence | null }) {
  if (!evidence) return null;
  if (id === "checks") {
    const report = evidence.checks;
    if (!report) return <p>Chưa có kết quả kiểm tra.</p>;
    return <>
      <p>{report.ok ? "Đạt mọi kiểm tra." : `${report.issues.length} vấn đề cần sửa.`}</p>
      <ul>{report.issues.slice(0, 20).map((issue, index) => (
        <li key={issue.code + index}>{issue.scene_id ? <strong>{issue.scene_id} · </strong> : null}{issueText(issue)} <code>{issue.code}</code></li>))}</ul>
    </>;
  }
  if (id === "cover") return evidence.cover ? <p>Ảnh bìa: “{evidence.cover.headline}” (cảnh {evidence.cover.scene_id})</p> : <p>Chưa có ảnh bìa.</p>;
  if (id === "publish") return evidence.publish
    ? <><p><strong>{evidence.publish.title}</strong></p><p>{evidence.publish.description}</p><p>{(evidence.publish.hashtags ?? []).join(" ")}</p></>
    : <p>Chưa có nội dung đăng.</p>;
  if (id === "inspect") return evidence.inspect
    ? <><p>Cách kiểm: {evidence.inspect.method === "visual" ? "nhìn khung hình" : "cấu trúc"}.</p>
      <ul>{evidence.inspect.findings.slice(0, 40).map((f, index) => <li key={index}><code>{f.severity}</code> [{f.scene_id}] {f.note}</li>)}</ul></>
    : <p>Chưa có báo cáo kiểm khung hình.</p>;
  return null;
}

/** Fallback inspector: node status, its detail, and the agent evidence relevant to it. */
export default function GenericInspector({ project, node }: InspectorProps) {
  const needsEvidence = ["checks", "cover", "publish", "inspect"].includes(node.id);
  const { evidence } = useEvidence(needsEvidence ? project?.project_id : undefined, node.status);
  return (
    <div className="source-context generic-inspector">
      <h2>{node.title}</h2>
      <p>Trạng thái: <strong>{STATUS_LABEL[node.status]}</strong></p>
      {node.detail && node.id !== "checks" && <p>{node.detail}</p>}  {/* the checks report below says it already */}
      <Body id={node.id} evidence={evidence} />
    </div>
  );
}
