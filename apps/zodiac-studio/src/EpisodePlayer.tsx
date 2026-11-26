import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { episodePreview } from "./episode-preview-cache";
import { createPlaybackClock } from "./playback-clock";

type Timeline = { seek(time: number, suppressEvents?: boolean): void; pause(): void };

/**
 * The whole episode in one HyperFrames composition, so scene transitions play and nothing is swapped at a scene boundary.
 * The selected voice is the clock; the composition is only ever seeked to it (it never runs by itself).
 */
export default function EpisodePlayer({ projectId, buildId, audioUrl, durationMs, onError, startMs = 0, autoplay = false, onTime, onPlaybackStart }: {
  projectId: string; buildId: string; audioUrl: string; durationMs: number; onError: (error: unknown) => void;
  startMs?: number; autoplay?: boolean; onTime?: (ms: number) => void;
  onPlaybackStart?: () => void;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [ready, setReady] = useState(false), [playing, setPlaying] = useState(false), [time, setTime] = useState(0), [scale, setScale] = useState(0.25);
  const frame = useRef<HTMLIFrameElement>(null), audio = useRef<HTMLAudioElement>(null), box = useRef<HTMLDivElement>(null), clock = useRef(0);
  const total = Math.max(1, durationMs / 1000);

  useEffect(() => {
    let live = true;
    setHtml(null); setReady(false); setPlaying(false);
    episodePreview(projectId, buildId).then((page) => { if (live) setHtml(page.html); }).catch((error) => { if (live) onError(error); });
    return () => { live = false; };
  }, [projectId, buildId, onError]);

  useEffect(() => {
    const node = box.current; if (!node) return;
    const observer = new ResizeObserver(() => setScale(Math.min(node.clientWidth / 1080, node.clientHeight / 1920)));
    observer.observe(node); return () => observer.disconnect();
  }, [html]);

  const seek = (seconds: number) => {
    const at = Math.max(0, Math.min(total, seconds));
    clock.current = at; setTime(at); onTime?.(at * 1000);
    const timeline = (frame.current?.contentWindow as unknown as { __timelines?: Record<string, Timeline> } | null)?.__timelines?.episode;
    if (timeline) { timeline.pause(); timeline.seek(at, false); }
    if (audio.current && audioUrl) audio.current.currentTime = at;
  };

  useEffect(() => {
    const sound = audio.current;
    if (!playing || !ready) { sound?.pause(); return; }
    let handle = 0, live = true;
    if (sound && audioUrl) {
      sound.currentTime = clock.current;
      void sound.play().then(() => { if (live) onPlaybackStart?.(); else sound.pause(); }).catch((error) => { if (live) { setPlaying(false); onError(error); } });
    } else onPlaybackStart?.();
    const steady = createPlaybackClock(clock.current * 1000, audio.current && audioUrl ? () => (audio.current ? audio.current.currentTime * 1000 : null) : null, performance.now());
    const tick = (now: number) => {
      const at = steady.at(now) / 1000;  // frame-timer clock, corrected by the voice only when they really drift apart
      if (at >= total) { seek(total); setPlaying(false); return; }
      seek(at); handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => { live = false; cancelAnimationFrame(handle); sound?.pause(); };
  }, [playing, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="episode-player" data-ready={ready ? "true" : "false"}>
      <div className="episode-player-stage" ref={box}>
        {html === null ? <p className="voice-muted">Đang ghép cả video…</p>
          : <iframe ref={frame} title="Cả video, có chuyển cảnh" srcDoc={html} sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer"
              style={{ width: 1080, height: 1920, transform: `scale(${scale})` }}
              onLoad={() => {
                setReady(true);
                seek(startMs / 1000);
                window.setTimeout(() => { seek(clock.current); if (autoplay) setPlaying(true); }, 250);
              }} />}
      </div>
      <div className="visual-transport">
        <button className="outline-btn" aria-label={playing ? "Tạm dừng" : "Phát cả video"} disabled={!ready} onClick={() => { if (!playing && clock.current >= total) seek(0); setPlaying(!playing); }}>
          {playing ? <Pause size={15} /> : <Play size={15} />}</button>
        <span>{time.toFixed(1)} / {total.toFixed(1)}s</span>
        <input type="range" aria-label="Thời gian cả video" min={0} max={total} step={1 / 30} value={time} disabled={!ready} onChange={(e) => { setPlaying(false); seek(Number(e.target.value)); }} />
        <small>{audioUrl ? "Voice đã chọn" : "Không có audio"}</small>
      </div>
      {audioUrl && <audio ref={audio} src={audioUrl} preload="auto" onEnded={() => setPlaying(false)} />}
    </div>
  );
}
