export type IdeaStatus = "not_started" | "in_progress" | "mp4_approved";
export type IdeaConcept = { id: string; title: string; direction: string };
export type IdeaProgress = { concept_id: string; sign: string; status: IdeaStatus; updated_at: number };
export type IdeaBoard = { signs: string[]; groups: { id: string; title: string; subtitle: string; concepts: IdeaConcept[] }[]; progress: IdeaProgress[] };

export function statusFor(board: IdeaBoard, concept: string, sign: string): IdeaStatus {
  return board.progress.find(row => row.concept_id === concept && row.sign === sign)?.status ?? "not_started";
}

export type SignState = "not_started" | "in_progress" | "mp4_approved";

/** Manual approval wins; otherwise an imported episode for this concept and sign means the work has started. */
export function signState(board: IdeaBoard, concept: string, sign: string, hasEpisode: boolean): SignState {
  const saved = statusFor(board, concept, sign);
  if (saved === "mp4_approved") return saved;
  return saved === "in_progress" || hasEpisode ? "in_progress" : "not_started";
}

export function conceptById(board: IdeaBoard | null, id: string | null | undefined): IdeaConcept | undefined {
  if (!board || !id) return undefined;
  for (const group of board.groups) { const hit = group.concepts.find((c) => c.id === id); if (hit) return hit; }
  return undefined;
}

export function buildIdeaPrompt(board: IdeaBoard, concept: IdeaConcept, chosenSign?: string, episodeSigns: string[] = []): string | null {
  const completed = board.signs.filter(sign => statusFor(board, concept.id, sign) === "mp4_approved");
  const ongoing = board.signs.filter(sign => !completed.includes(sign) && (statusFor(board, concept.id, sign) === "in_progress" || episodeSigns.includes(sign)));
  const untouched = board.signs.filter(sign => !completed.includes(sign) && !ongoing.includes(sign));
  if (completed.length === board.signs.length) return null;
  if (chosenSign && completed.includes(chosenSign)) return null;
  return [
    "Dùng plugin @Zodiac-Video-Web (Zodiac Video Web), skill zodiac-video-web:zodiac-video-web, để thực hiện yêu cầu này.",
    "Trước khi sáng tác, đọc SKILL.md và các references liên quan của plugin đang được gắn trong cuộc chat; lấy đó làm chuẩn cấu trúc, chất lượng và bàn giao. Nếu không truy cập được plugin/skill, dừng và yêu cầu tôi chọn @Zodiac-Video-Web; không tự thay bằng workflow chung hay giả định đã đọc plugin.",
    "Đây là brief concept và tiến độ từ Studio; concept vẫn phải qua các gate sáng tạo của plugin, chưa phải nội dung đã duyệt.", "",
    "Hãy phát triển một tập video Zodiac tiếng Việt theo concept sau.",
    `Mã concept: ${concept.id}`, `Concept / tên tập: ${concept.title}`,
    `Ý tưởng triển khai: ${concept.direction}`, "",
    `MP4 đã duyệt: ${completed.join(", ") || "Chưa có"}.`,
    `Đang làm: ${ongoing.join(", ") || "Chưa có"}.`,
    chosenSign ? `Cung được chọn: ${chosenSign} (đã chốt, không đổi cung).` : `Cung được chọn: ${(untouched.length ? untouched : ongoing).join(", ")} (agent tự chọn 1 cung hợp nhất)`,
    chosenSign ? "Viết tập này cho đúng cung đã chốt; giải thích ngắn vì sao concept hợp với cung đó và ghi rõ tên cung ngay đầu kết quả." : "Tự chọn đúng 1 cung trong danh sách được chọn, giải thích ngắn vì sao concept hợp với cung đó và ghi rõ tên cung ngay đầu kết quả.",
    untouched.length ? "Ưu tiên tập mới; không chọn lại cung đã có MP4 duyệt hoặc đang làm."
      : "Các cung còn lại đều đang làm: hỏi nguồn hiện có để tiếp tục phần còn thiếu, tránh tạo lại tập từ đầu.",
    "Giữ đúng hướng triển khai và khác biệt của cung; dùng hành động/phản ứng cụ thể khi phù hợp, tránh lời mô tả tính cách chung chung hoặc ép tình huống lấn át góc nhìn Zodiac.",
    "Với tập mới, làm Phase 1 theo plugin: Evidence → Voice → Concept → Narrative Design → Narration → Content Review; tự tiếp tục giữa các bước, dừng ở Content Review để tôi duyệt.",
    "Áp dụng Recognition & Identity Gate, giới hạn suy luận theo bằng chứng, narrative motif/nhịp nửa sau và dual editorial read theo plugin. Quyết định story_visuals hoặc lý do omitted trước Content Review; không thiết kế geometry/asset Phase 2.",
    "Trước Content Review, hoàn thiện Narrative Plan 2.1 với beats và performance intent, kiểm tra voice_anchor chính xác cùng occurrence nếu lặp, theo cấu trúc bắt buộc của plugin; không tự cấp Content Review hay Visual Review.",
    "Chỉ sau khi tôi duyệt Content Review, tạo ZIP zodiac-phase1-handoff@2 đúng payload, SHA-256 và receipt gắn với nguồn đã duyệt theo plugin; không chạy Phase 2 trên Web. Với tập đang làm, kiểm tra nguồn và trạng thái duyệt hiện có để tiếp tục, không viết lại nguồn đã duyệt hoặc tự tạo receipt.",
    "Checklist chỉ hoàn thành khi MP4 cuối được tôi xem và duyệt. Copy prompt, xong kịch bản hay render kỹ thuật đều chưa tính hoàn thành.",
    "Khi bàn giao, ghi rõ mã concept và cung đã chọn để tôi cập nhật tiến độ trong Studio.",
  ].join("\n");
}
