import type { VoiceState } from "./backend";

const REASON_TEXT = { take_changed: "đã đổi take", pause_changed: "đã đổi khoảng nghỉ", narration_changed: "lời dẫn đã đổi", voice_changed: "đã đổi giọng" } as const;

/** After an edit only some segments lack the user's listening proof: say which, instead of asking for the whole episode. */
export function listenHintText(state: Pick<VoiceState, "segments_needing_listen" | "units"> | null): string | null {
  const ids = state?.segments_needing_listen ?? [];
  if (!state || ids.length === 0 || ids.length >= state.units.length) return null;
  const numbers = ids.map((id) => state.units.findIndex((u) => u.id === id) + 1).filter((n) => n > 0);
  return `Chỉ cần nghe lại đoạn ${numbers.join(", ")} ở tab “Từng đoạn”, rồi ghép audio lại.`;
}

/** "Cần nghe lại vì đã đổi khoảng nghỉ (đoạn 2)" from the backend's approval_note; null when nothing was dropped. */
export function approvalNoteText(state: Pick<VoiceState, "approval_note" | "units"> | null): string | null {
  const note = state?.approval_note;
  if (!note) return null;
  const numbers = note.unit_ids.map((id) => (state!.units.findIndex((u) => u.id === id) + 1) || id);
  return `Cần nghe lại vì ${REASON_TEXT[note.reason] ?? note.reason}${numbers.length ? ` (đoạn ${numbers.join(", ")})` : ""}.`;
}
