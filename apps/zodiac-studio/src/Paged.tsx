import { useEffect, useRef, useState, type ReactNode } from "react";

export function Paged({ children, size = 3, label = "Danh sách", revealIndex }: { children: ReactNode[]; size?: number; label?: string; revealIndex?: number }) {
  const [requested, setPage] = useState(0);
  useEffect(() => {if(revealIndex !== undefined && revealIndex>=0)setPage(Math.floor(revealIndex/size));},[revealIndex,size]);
  const pages = Math.max(1, Math.ceil(children.length / size));
  const page = Math.min(requested, pages - 1);
  return <div className="paged">
    <div className="paged-items">{children.slice(page * size, (page + 1) * size)}</div>
    <nav className="pagination" aria-label={label}>
      <button type="button" disabled={!page} onClick={() => setPage(page - 1)} aria-label={`${label}: trang trước`}>‹</button>
      <span aria-live="polite">{page + 1} / {pages} · {children.length} mục</span>
      <button type="button" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} aria-label={`${label}: trang sau`}>›</button>
    </nav>
  </div>;
}

export function PagedText({ text, onChange, label = "Nội dung", size = 360, maxLines = 7 }: { text: string; onChange?: (text: string) => void; label?: string; size?: number; maxLines?: number }) {
  const [requested, setPage] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(30);
  const [rows, setRows] = useState(maxLines);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const editor = node.querySelector("textarea");
    const observer = new ResizeObserver(() => {
      if (node.clientWidth) setColumns(Math.max(1, Math.floor((node.clientWidth - 28) / 7.3)));
      if (editor && editor.clientHeight) {
        const style = getComputedStyle(editor);
        const available = editor.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
        setRows(Math.max(1, Math.min(maxLines, Math.floor(available / parseFloat(style.lineHeight)) - 1)));
      }
    });
    observer.observe(node);
    if (editor) observer.observe(editor);
    return () => observer.disconnect();
  }, [maxLines, onChange !== undefined]);
  const chars = Array.from(text);
  const boundaries = [0];
  let lines = 1, column = 0;
  for (let i = 0; i < chars.length; i++) {
    if (i - boundaries[boundaries.length - 1] >= size || lines > rows) {
      boundaries.push(i); lines = 1; column = 0;
    }
    if (chars[i] === "\n") { lines++; column = 0; }
    else if (++column >= columns) { lines++; column = 0; }
  }
  const pages = boundaries.length;
  const page = Math.min(requested, pages - 1), start = boundaries[page], end = boundaries[page + 1] ?? chars.length;
  const value = chars.slice(start, end).join("");
  return <div className="paged-text" ref={root}>
    {onChange ? <textarea aria-label={label} spellCheck={false} value={value} onChange={event =>
      onChange(chars.slice(0, start).join("") + event.target.value + chars.slice(end).join(""))}/> :
      <div className="text-page" aria-label={label}>{value || "—"}</div>}
    {pages > 1 && <nav className="pagination" aria-label={label}>
      <button type="button" disabled={!page} onClick={() => setPage(page - 1)} aria-label={`${label}: trang trước`}>‹</button>
      <span aria-live="polite">{page + 1} / {pages}</span>
      <button type="button" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} aria-label={`${label}: trang sau`}>›</button>
    </nav>}
  </div>;
}
