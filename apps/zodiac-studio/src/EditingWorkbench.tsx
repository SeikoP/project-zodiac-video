import type {ReactNode} from "react";
import {Clapperboard} from "lucide-react";

export default function EditingWorkbench({children, title, onImport}: {
  children: ReactNode; title?: string; onImport: () => void;
}) {
  return <section className="editing-workbench" aria-label="Bàn dựng episode">
    <header className="workbench-heading">
      <div><h1><Clapperboard size={19}/>Dựng hình ảnh</h1><p>{title || "Nhập episode để bắt đầu dựng hình"}</p></div>
      <button className="outline-btn" onClick={onImport}>Nhập episode</button>
    </header>
    {children}
  </section>;
}
