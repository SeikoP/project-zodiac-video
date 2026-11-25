/** Plain Vietnamese for a blocked build: which scene, what is wrong. The raw compiler text stays available as `detail`. */
const CODE_TEXT: [RegExp, string][] = [
  [/VISUAL_LAYER_INVALID/, "thông số lớp (layer) không hợp lệ"],
  [/TRACE_STATE_BEFORE/, "thứ tự trạng thái của sự kiện không khớp"],
  [/VISUAL_TRANSITION_INVALID/, "chuyển cảnh không hợp lệ"],
  [/VISUAL_TRANSFORM_INVALID/, "vị trí hoặc kích thước không hợp lệ"],
  [/VISUAL_EVENT_INVALID/, "sự kiện trỏ tới đối tượng hoặc trạng thái không có"],
  [/VISUAL_ENTER_/, "chuyển động bay vào không hợp lệ"],
  [/ROLE_RESOLUTION_INVALID/, "vai trò hiển thị của đối tượng không hợp lệ"],
  [/VISUAL_ACTING_/, "chuyển động diễn xuất không hợp lệ"],
];

export function buildBlockedText(raw: string): { summary: string; detail: string } {
  const detail = raw.split("\n").slice(0, 6).join("\n").slice(0, 600);
  const first = (raw.split("\n").find((line) => line.trim()) ?? "").replace(/^(VISUAL_BUILD_BLOCKED:\s*)?Error:\s*/, "").trim();
  const missing = /VISUAL_ASSET_MISSING\s+(\S+)/.exec(raw);
  if (missing) {
    const scene = /^(s\d+)-/i.exec(missing[1])?.[1] ?? /\[scene (\S+)\]/.exec(raw)?.[1];
    return { summary: `${scene ? `Cảnh ${scene} thiếu` : "Thiếu"} tài nguyên ${missing[1]}`, detail };
  }
  const scene = /\[scene (\S+?)\]/.exec(raw)?.[1];
  const known = CODE_TEXT.find(([pattern]) => pattern.test(raw));
  if (known) return { summary: scene ? `Cảnh ${scene}: ${known[1]}` : known[1][0].toUpperCase() + known[1].slice(1), detail };
  return { summary: first.replace(/\s*\[scene \S+\]\s*$/, ""), detail };
}

const JOB_TEXT: Record<string, string> = {
  "Build blocked; last good preview preserved": "Không dựng được; giữ bản xem trước tốt gần nhất.",
  "Verified episode build ready": "Đã dựng xong và kiểm tra.",
};
export const buildJobMessage = (message: string) => JOB_TEXT[message] ?? message;
