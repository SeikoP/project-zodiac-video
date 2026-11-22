import { useEffect, useState } from "react";
import { backend, type AssetGalleryData, type GalleryAsset } from "./backend";
import { Paged, PagedText } from "./Paged";

const labels: Record<string, string> = { body: "Dáng người", hair: "Tóc", outfit: "Trang phục", face: "Biểu cảm", pose: "Tư thế", prop: "Đạo cụ", meme: "Meme", context: "Bối cảnh", character: "Nhân vật" };

export default function AssetGallery({ projectId, onFind }: { projectId: string | null; onFind?: (id: string) => void }) {
  const [data, setData] = useState<AssetGalleryData | null>(null), [error, setError] = useState("");
  const [query, setQuery] = useState(""), [role, setRole] = useState(""), [selectedId, setSelectedId] = useState("");
  const [themeId, setThemeId] = useState("light"), [refresh, setRefresh] = useState(0), [detail, setDetail] = useState("source");
  useEffect(() => {
    let live = true; setData(null); setError("");
    if (projectId) void backend.assetGallery(projectId).then(value => { if (live) setData(value); }).catch(failure => { if (live) setError(String(failure)); });
    return () => { live = false; };
  }, [projectId, refresh]);
  const items = (data?.items ?? []).filter(row => (!role || row.role === role) && `${row.id} ${row.contexts.join(" ")}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const selected = items.find(row => row.id === selectedId) ?? items[0];
  const theme = data?.themes.find(row => row.id === themeId) ?? data?.themes[0];
  const usageText = selected?.usage?.map(row => `${row.episode_id} · cảnh ${row.scene_ids.join(", ")}\nBuild kỹ thuật · chưa duyệt hình\nBuild: ${row.build_id}\nManifest SHA-256: ${row.manifest_sha256}`).join("\n\n") || "Chưa có build khác được xác minh dùng đúng nguồn asset này.";
  const image = (row: GalleryAsset) => row.preview_data_uri ?? (row.svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(row.svg)}` : undefined);
  return <section className="asset-gallery" aria-label="Thư viện hình ảnh V5">
    <div className="gallery-toolbar"><strong>Kho hình ảnh · V4 / V5</strong>
      <input aria-label="Tìm hình ảnh" placeholder="Tìm ID hoặc ngữ cảnh…" value={query} onChange={e => setQuery(e.target.value)}/>
      <select aria-label="Loại hình ảnh" value={role} onChange={e => setRole(e.target.value)}><option value="">Tất cả thành phần</option>{[...new Set(data?.items.map(row => row.role) ?? [])].map(id => <option key={id} value={id}>{labels[id] ?? id}</option>)}</select>
      <select aria-label="Palette xem thử" value={theme?.id ?? "light"} onChange={e => setThemeId(e.target.value)}>{data?.themes.map(t => <option key={t.id} value={t.id}>{t.title ?? t.id}</option>)}</select>
      <button className="outline-btn" onClick={() => setRefresh(value => value + 1)} disabled={!projectId}>Làm mới</button></div>
    {error && <p role="alert" className="voice-warning">{error}</p>}
    {!projectId ? <p>Chọn episode để xem thư viện và nguồn hình ảnh.</p> : !data ? <p>{error ? "Chưa đọc được thư viện." : "Đang đọc nguồn và preview…"}</p> : <div className="gallery-layout">
      <div className="panel gallery-list"><Paged key={`${query}:${role}`} size={4} label="Hình ảnh">{items.map(row => <button className={`gallery-card ${row.id === selected?.id ? "active" : ""}`} key={row.id} onClick={() => setSelectedId(row.id)}>
        {image(row) ? <img src={image(row)} alt={row.id}/> : <span>Chưa có preview</span>}<strong>{row.id}</strong><small>{labels[row.role] ?? row.role}</small></button>)}</Paged>{!items.length && <p>Không có hình phù hợp.</p>}</div>
      <div className="panel gallery-preview" style={{ background: theme?.canvas, color: theme?.ink }}>
        {selected && image(selected) ? <img src={image(selected)} alt={`Preview ${selected.id}`}/> : <p>Chọn thành phần có preview.</p>}
        <span className="gallery-caption" style={{ background: theme?.caption, color: theme?.caption_ink }}>Nhân vật diễn rõ · lời kể dẫn nhịp</span>
        <small>Nền và caption theo palette; hình giữ màu nguồn.</small></div>
      <aside className="panel gallery-inspector"><strong>{selected?.id ?? "Chưa chọn"}</strong>
        <div className="workspace-tabs">{[["source", "Nguồn"], ["context", "Ngữ cảnh"], ["contact", "Tiếp xúc"]].map(([id, title]) => <button key={id} aria-pressed={detail === id} onClick={() => setDetail(id)}>{title}</button>)}</div>
        <PagedText key={`${selected?.id}:${detail}`} size={220} text={selected ? detail === "source" ? `Vai trò: ${selected.role}\nNguồn: ${selected.path ?? selected.id}\nSHA-256: ${selected.source_sha256}\nCatalog: ${data.source_revision}\n${JSON.stringify(selected.identity ?? {}, null, 2)}` : detail === "context" ? `Ngữ cảnh: ${selected.contexts.join(", ") || "Chưa khai báo"}\nLịch sử:\n${usageText}${data.usage_evidence?.coverage?.truncated ? "\nPhạm vi giới hạn: tối đa 500 project và 50 build gần nhất trong phạm vi đã quét." : ""}` : JSON.stringify(selected.contact ?? "Chưa có contact geometry được xác minh; kiểm tra bundle của cảnh trước khi thay đạo cụ.", null, 2) : ""}/>
        {onFind && <button className="primary-btn" disabled={!selected} onClick={() => selected && onFind(selected.id)}>Kiểm tra phù hợp cảnh</button>}
        <small>Thư viện để xem nguồn. Thay asset qua composition đã kiểm tra; xem và chọn palette không duyệt hình.</small>
      </aside></div>}
  </section>;
}
