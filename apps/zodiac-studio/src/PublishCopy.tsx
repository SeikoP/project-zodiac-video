import { useState } from "react";
import type { PipelineEvidence } from "./pipeline/types";

/** Everything to paste into TikTok, one row per field with its own copy button, and one button for the whole block. */
export default function PublishCopy({ publish, cover }: { publish: PipelineEvidence["publish"]; cover?: PipelineEvidence["cover"] }) {
  const [copied, setCopied] = useState(""), [failed, setFailed] = useState("");
  if (!publish) return null;
  const tags = (publish.hashtags ?? []).join(" ");
  const hook = publish.cover_hook || cover?.headline || "";
  const rows: { key: string; label: string; text: string; multiline?: boolean }[] = [
    { key: "title", label: "Tiêu đề", text: publish.title ?? "" },
    { key: "hook", label: "Hook ảnh bìa", text: hook },
    { key: "caption", label: "Caption TikTok", text: publish.description ?? "", multiline: true },
    { key: "tags", label: `Hashtag (${publish.hashtags?.length ?? 0})`, text: tags },
    ...(publish.alt_hooks ?? []).map((text, i) => ({ key: `alt${i}`, label: `Hook thay thế ${i + 1}`, text })),
  ].filter(row => row.text);
  const all = [["TITLE", publish.title], ["COVER HOOK", hook], ["TIKTOK CAPTION", publish.description], ["HASHTAGS", tags]]
    .filter(([, value]) => value).map(([name, value]) => `${name}:\n${value}`).join("\n\n");
  const copy = (key: string, text: string) => {
    setFailed("");
    void navigator.clipboard.writeText(text).then(() => { setCopied(key); window.setTimeout(() => setCopied(""), 1800); })
      .catch(e => setFailed(String(e)));
  };
  return <section className="publish-copy" aria-label="Thông tin video">
    <div className="publish-copy-head"><strong>Thông tin video</strong>
      <small role="status">{failed || (copied ? "Đã copy" : "")}</small>
      <button className="primary-btn" onClick={() => copy("all", all)}>{copied === "all" ? "Đã copy" : "Copy tất cả"}</button></div>
    {rows.map(row => <div className="publish-row" key={row.key}>
      <div><small>{row.label}</small><p className={row.multiline ? "publish-text multiline" : "publish-text"}>{row.text}</p></div>
      <button className="subtle-btn" onClick={() => copy(row.key, row.text)}>{copied === row.key ? "Đã copy" : "Copy"}</button></div>)}
  </section>;
}
