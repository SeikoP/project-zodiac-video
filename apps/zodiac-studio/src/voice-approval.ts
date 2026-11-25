import type { VoiceState } from "./backend";

const REASON_TEXT = { take_changed: "đã đổi take", pause_changed: "đã đổi khoảng nghỉ", narration_changed: "lời dẫn đã đổi", voice_changed: "đã đổi giọng" } as const;

/** "Cần nghe lại vì đã đổi khoảng nghỉ (đoạn 2)" from the backend's approval_note; null when nothing was dropped. */
export function approvalNoteText(state: Pick<VoiceState, "approval_note" | "units"> | null): string | null {
  const note = state?.approval_note;
  if (!note) return null;
  const numbers = note.unit_ids.map((id) => (state!.units.findIndex((u) => u.id === id) + 1) || id);
  return `Cần nghe lại vì ${REASON_TEXT[note.reason] ?? note.reason}${numbers.length ? ` (đoạn ${numbers.join(", ")})` : ""}.`;
}
