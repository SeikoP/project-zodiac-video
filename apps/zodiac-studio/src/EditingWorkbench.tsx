import type {ReactNode} from "react";
import {Clapperboard, Headphones, Upload} from "lucide-react";

export default function EditingWorkbench({children, title, onVoice, onExport, onImport}: {
  children: ReactNode; title?: string; onVoice: () => void; onExport: () => void; onImport: () => void;
}) {
  return <section className="editing-workbench" aria-label="Bàn dựng episode">
    <header className="workbench-heading">
      <div><h1><Clapperboard size={19}/>Bàn dựng video</h1><p>{title || "Nhập episode để bắt đầu dựng video"}</p></div>
      <div className="workbench-actions">
        <button className="outline-btn" onClick={onImport}>Nhập episode</button>
        <button className="outline-btn" aria-label="Mở giọng đọc" onClick={onVoice}><Headphones size={15}/>Giọng đọc</button>
        <button className="primary-btn" aria-label="Xuất video" onClick={onExport}><Upload size={15}/>Xuất video</button>
      </div>
    </header>
    {children}
  </section>;
}
