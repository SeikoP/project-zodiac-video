import {useState} from "react";
import {Pause, Play} from "lucide-react";
import type {TimelineScene} from "./episode-timeline";
import type {VoiceState} from "./backend";

export function timecode(ms: number): string {
  return `${Math.floor(ms/60000).toString().padStart(2,"0")}:${Math.floor(ms/1000%60).toString().padStart(2,"0")}.${Math.floor(ms%1000/100)}`;
}

export default function EpisodeTimeline({scenes, sceneId, timeMs, playing, canPlay, voice, onSeek, onPlay, titles}: {
  scenes: TimelineScene[]; sceneId?: string; timeMs: number; playing: boolean; canPlay: boolean;
  voice: VoiceState | null; onSeek: (ms: number) => void; onPlay: () => void; titles: Record<string,string>;
}) {
  const [zoom,setZoom] = useState(1);
  const duration=scenes.at(-1)?.endMs ?? 0;
  const words=voice?.timing?.words ?? [];
  const spoken=words.filter(w=>w.endMs>timeMs && w.startMs<timeMs+2200).map(w=>w.text).join(" ");
  return <section className="episode-timeline" aria-label="Timeline toàn video">
    <div className="timeline-header">
      <button className="outline-btn timeline-play" aria-label={playing ? "Tạm dừng video" : "Phát toàn video"} disabled={!canPlay && !playing} onClick={onPlay}>{playing ? <Pause size={16}/> : <Play size={16}/>}</button>
      <strong>{timecode(timeMs)} <span>/ {timecode(duration)}</span></strong>
      <small>Timeline toàn video</small>
      <label>Thu phóng<select aria-label="Thu phóng timeline" value={zoom} onChange={e=>setZoom(Number(e.target.value))}><option value={1}>Vừa khung</option><option value={2}>2×</option><option value={4}>4×</option></select></label>
    </div>
    {duration ? <>
      <input className="episode-scrubber" type="range" aria-label="Vị trí toàn video" min={0} max={duration} step={1} value={Math.min(timeMs,duration)} onChange={e=>onSeek(Number(e.target.value))}/>
      <div className="timeline-scroll"><div className="timeline-tracks" style={{width:`${zoom*100}%`}}>
        <div className="timeline-ruler">{Array.from({length:7},(_,i)=><span key={i}>{timecode(duration*i/6)}</span>)}</div>
        <div className="timeline-scene-track">{scenes.map((s,i)=><button key={s.id} aria-label={`Cảnh ${i+1} · ${titles[s.id] || s.id}`} aria-pressed={s.id===sceneId} style={{left:`${s.startMs/duration*100}%`,width:`${(s.endMs-s.startMs)/duration*100}%`}} title={`${titles[s.id] || s.id} · ${timecode(s.startMs)}–${timecode(s.endMs)}`} onClick={()=>onSeek(s.startMs)}><b>{String(i+1).padStart(2,"0")}</b><span>{titles[s.id] || s.id}</span></button>)}</div>
        <div className="timeline-voice-track" aria-label="Giọng đọc đo thực tế">{voice?.assembly ? <><span>Giọng đọc</span><svg viewBox="0 0 600 22" preserveAspectRatio="none" aria-label="Biên độ giọng đọc thật">{voice.assembly.peaks.map((p,i)=><line key={i} x1={i*600/voice.assembly!.peaks.length} x2={i*600/voice.assembly!.peaks.length} y1={11-Math.min(1,Math.abs(p))*10} y2={11+Math.min(1,Math.abs(p))*10} stroke="currentColor" strokeWidth="2"/>)}</svg></> : <span>Chưa có giọng đọc khớp bản dựng</span>}</div>
        <div className="timeline-playhead" style={{left:`${timeMs/duration*100}%`}}/>
      </div></div>
      <div className="timeline-spoken"><span>Lời đọc</span>{spoken || (words.length ? "Khoảng nghỉ" : "Chưa có timing giọng đọc")}</div>
    </> : <p className="timeline-empty">Dựng các cảnh để mở timeline theo thời gian giọng đọc.</p>}
  </section>;
}
