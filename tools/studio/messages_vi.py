#!/usr/bin/env python3
"""Reusable Vietnamese copy for Zodiac Studio. One place, no repeated strings."""

from __future__ import annotations

from tools.studio.pipeline import (
    ALIGN_TIMING,
    CONCAT_VOICE,
    IMPORT_PACKAGE,
    MIX_MUSIC,
    PREFLIGHT,
    PREPARE_RENDERER,
    RENDER_VIDEO,
    VALIDATE_RUNTIME,
    VOICE_SCENES,
)

APP_TITLE = "Zodiac Studio"
APP_SUBTITLE = "Giọng đọc, xem trước và kết xuất video"

STEP_NAMES_VI = {
    IMPORT_PACKAGE: "Nhập gói video",
    PREFLIGHT: "Kiểm tra môi trường",
    VOICE_SCENES: "Tạo giọng đọc",
    CONCAT_VOICE: "Ghép voice.wav",
    ALIGN_TIMING: "Căn thời gian từ",
    VALIDATE_RUNTIME: "Kiểm tra runtime",
    PREPARE_RENDERER: "Chuẩn bị renderer",
    RENDER_VIDEO: "Kết xuất video",
    MIX_MUSIC: "Trộn nhạc nền",
}

SECTION_PROJECT = "DỰ ÁN"
SECTION_SETUP = "THIẾT LẬP"
SECTION_PIPELINE = "QUY TRÌNH"
SECTION_OUTPUT = "KẾT QUẢ"
SECTION_LOG = "NHẬT KÝ"

LABEL_ARCHIVE = "Gói video"
LABEL_JOB = "Job"
LABEL_VOICE = "Giọng đọc"
LABEL_MUSIC = "Nhạc nền"
LABEL_VOLUME = "Âm lượng"
LABEL_ALIGN_MODEL = "Độ chính xác căn từ"

# Measured on the real Virgo job: small, medium and large-v3 all produced the
# same 88/89-word result, because the mismatch comes from the TTS reading too
# fast, not from model quality. So the fastest model wins on CPU.
ALIGN_MODEL_DEFAULT = "small"
ALIGN_MODEL_CHOICES = ("small", "medium", "large-v3")
ALIGN_MODEL_HINT = "small nhanh nhất và cho kết quả giống medium trên CPU."
LABEL_MORE = "…"
LABEL_PATH_PLACEHOLDER = "Chưa chọn"
LABEL_PIPELINE_BASENAME = "Job: "
LABEL_DETAILS = "Chi tiết kỹ thuật"

BTN_BROWSE = "Chọn…"
BTN_CONTINUE = "Tiếp tục"
BTN_RUN_ALL = "Chạy toàn bộ"
BTN_CANCEL = "Dừng"
BTN_RERUN = "Chạy lại bước"
BTN_OPEN_EDITOR = "Mở Editor"
BTN_CHECK = "Kiểm tra"
BTN_LISTEN = "Nghe thử"
BTN_OPEN_VIDEO = "Mở video"
BTN_OPEN_FOLDER = "Mở thư mục"
BTN_START_SERVICE = "Khởi động"
BTN_STOP_SERVICE = "Dừng server"
BTN_INSTALL_DEPS = "Cài dependency còn thiếu"
BTN_COPY_COMMAND = "Sao chép lệnh"
BTN_SHOW_LOGS = "Xem nhật ký"
BTN_HIDE_LOGS = "Ẩn nhật ký"
BTN_STUDIO_OPEN = "Mở Remotion Studio"
BTN_STUDIO_STOP = "Dừng Remotion Studio"
BTN_CLOSE = "Đóng"

STATUS_IDLE = "Chưa chạy"
STATUS_READY = "Sẵn sàng"
STATUS_RUNNING = "Đang chạy"
STATUS_DONE = "Hoàn tất"
STATUS_FAILED = "Thất bại"
STATUS_CANCELLED = "Đã dừng"
STATUS_SAVED = "Đã lưu"

SERVICE_ONLINE = "Đã kết nối"
SERVICE_OFFLINE = "Chưa kết nối · tự khởi động khi mở GUI"
SERVICE_STARTING = "Đang khởi động / nạp model…"
SERVICE_MISSING = "Không tìm thấy VieNeu"
SERVICE_STOPPING = "Đang dừng VieNeu…"

ENV_READY = "Sẵn sàng"
ENV_BUSY = "Đang chạy"
ENV_FAILED = "Thiếu dependency"

NO_VIDEO = "Chưa có video"
NO_MUSIC = "Chưa chọn nhạc nền"

# ---- errors -----------------------------------------------------------
ERROR_TITLES = {
    "DEPENDENCY_MISSING": "Môi trường chưa sẵn sàng",
    "PACKAGE_INVALID": "Gói video không hợp lệ",
    "VIENEU_UNAVAILABLE": "Không kết nối được VieNeu",
    "VOICE_SCENE_FAILED": "Không tạo được giọng đọc",
    "VOICE_INVALID": "File giọng đọc không hợp lệ",
    "ALIGNER_LOAD_FAILED": "Không tải được bộ căn thời gian từ",
    "ALIGNMENT_MISMATCH": "Căn thời gian từ không khớp lời thoại",
    "TIMING_INVALID": "Thời gian từ không hợp lệ",
    "NODE_MISSING": "Thiếu Node.js",
    "NPM_MISSING": "Thiếu npm",
    "FFMPEG_MISSING": "Thiếu FFmpeg",
    "RENDERER_INVALID": "Renderer không hợp lệ",
    "RENDER_FAILED": "Không kết xuất được video",
    "MIX_FAILED": "Không trộn được nhạc nền",
    "PUBLISH_BUNDLE_FAILED": "Không đóng được gói xuất bản",
    "CANCELLED_BY_USER": "Đã dừng theo yêu cầu",
    "SUBPROCESS_FAILED": "Lệnh thất bại",
}

ERROR_TITLES_BY_STEP = {
    IMPORT_PACKAGE: ERROR_TITLES["PACKAGE_INVALID"],
    PREFLIGHT: ERROR_TITLES["DEPENDENCY_MISSING"],
    VOICE_SCENES: ERROR_TITLES["VOICE_SCENE_FAILED"],
    CONCAT_VOICE: ERROR_TITLES["VOICE_INVALID"],
    ALIGN_TIMING: ERROR_TITLES["ALIGNER_LOAD_FAILED"],
    VALIDATE_RUNTIME: ERROR_TITLES["TIMING_INVALID"],
    PREPARE_RENDERER: ERROR_TITLES["RENDERER_INVALID"],
    RENDER_VIDEO: ERROR_TITLES["RENDER_FAILED"],
    MIX_MUSIC: ERROR_TITLES["MIX_FAILED"],
}

PIPELINE_DONE_MESSAGE = "Đã hoàn tất toàn bộ quy trình."
PIPELINE_CANCELLED_MESSAGE = "Đã dừng. Bước đã xong vẫn được giữ để chạy tiếp."
CHECK_DONE_MESSAGE = "Đã kiểm tra gói video và môi trường."
CHECK_FAILED_MESSAGE = "Kiểm tra không đạt."
TIMING_MISSING_MESSAGE = "Chưa có timing.json: căn thời gian từ chưa thể chạy."
NO_RESUME_MESSAGE = "Không còn bước nào cần chạy."
MUSIC_DISABLED_MESSAGE = "Không có nhạc nền: video cuối giữ voice/SFX."
STUDIO_OPENING_MESSAGE = "Remotion Studio đang chạy ở process riêng."
STUDIO_STOPPED_MESSAGE = "Remotion Studio đã đóng."
STUDIO_FAILED_MESSAGE = "Remotion Studio dừng bất thường."
DEPS_INSTALLED_MESSAGE = "Đã cài dependency. Đang kiểm tra lại môi trường…"
DEPS_INSTALL_FAILED_MESSAGE = "Không cài được dependency. Xem nhật ký để biết lý do."
DEPS_ALREADY_OK_MESSAGE = "Môi trường đã sẵn sàng, không cần cài gì thêm."
CHECK_ONLY_MESSAGE = "Đang kiểm tra gói video và môi trường…"
NO_JOB_MESSAGE = "Chọn gói video trước khi chạy quy trình."
DIRTY_EDITOR_TITLE = "Bạn có thay đổi chưa lưu"
EDITOR_OPEN_FAILED = "Không mở được Editor"

FINGERPRINT_CHANGED_TITLE = "Gói video đã thay đổi"
FINGERPRINT_CHANGED_MESSAGE = (
    "Gói ZIP đang chọn khác với gói đã nhập trước đó.\n"
    "Chọn 'Nhập lại' để thay thế job cũ, hoặc 'Giữ job cũ' để tiếp tục dùng."
)
FINGERPRINT_CONFIRM_IMPORT = "Nhập lại"
FINGERPRINT_CONFIRM_KEEP = "Giữ job cũ"

SAVED_PRODUCTION = "Đã lưu production.json"
SAVE_BLOCKED = "Không lưu được"