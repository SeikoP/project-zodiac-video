export type TimelineScene = { id: string; startMs: number; endMs: number };

/** Use measured intervals only; reject ambiguous builds rather than invent timings. */
export function makeEpisodeTimeline(scenes: {id: string; start_ms: number; end_ms: number}[]): TimelineScene[] {
  const rows = scenes.map(s => ({id: s.id, startMs: s.start_ms, endMs: s.end_ms})).sort((a,b) => a.startMs-b.startMs);
  const ids = new Set<string>();
  for (const [i, row] of rows.entries()) {
    if (!row.id || ids.has(row.id) || !Number.isFinite(row.startMs) || !Number.isFinite(row.endMs) ||
        row.startMs < 0 || row.endMs <= row.startMs || (i > 0 && row.startMs < rows[i-1].endMs)) {
      throw new Error("Thời gian cảnh không hợp lệ. Dựng lại video để cập nhật timeline.");
    }
    ids.add(row.id);
  }
  return rows;
}

export function locateEpisodeTime(scenes: TimelineScene[], timeMs: number): {sceneId: string; localMs: number} | null {
  if (!Number.isFinite(timeMs)) return null;
  const row = scenes.find((s, i) => timeMs >= s.startMs && (timeMs < s.endMs || (i === scenes.length-1 && timeMs === s.endMs)));
  return row ? {sceneId: row.id, localMs: timeMs-row.startMs} : null;
}
