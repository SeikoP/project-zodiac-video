"""`zodiac-library`: see every package/job/video in one list and tidy it safely."""

from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

from tools.application import library

ROOT = Path(__file__).resolve().parents[2]
LABELS = {"package": "GÓI", "job": "JOB", "legacy_job": "JOB CŨ", "cache": "ĐỆM"}


def _row(entry: library.Entry) -> str:
    when = datetime.fromtimestamp(entry.mtime).strftime("%Y-%m-%d %H:%M") if entry.mtime else "-"
    mark = "MỚI NHẤT" if entry.is_latest else ("lưu trữ" if entry.verdict == "archive" else "giữ")
    video = f" · {len(entry.videos)} video" if entry.videos else ""
    extra = f" · {entry.state}" if entry.state else ""
    note = f"  ← {entry.reason}" if entry.reason else ""
    return f"{LABELS[entry.kind]:7} {mark:9} {when}  {library.human_size(entry.size):>9}  {entry.name}{extra}{video}{note}"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="zodiac-library", description=__doc__)
    parser.add_argument("--project", type=Path, default=ROOT)
    parser.add_argument("--workspace", type=Path, default=None, help="mặc định: <project>/.zodiac-work")
    parser.add_argument("--no-sizes", action="store_true", help="bỏ qua đo dung lượng thư mục (nhanh hơn trên ổ chậm)")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("list", help="liệt kê mọi gói, job, video theo nhóm")
    clean = sub.add_parser("clean", help="chuyển bản cũ/trùng vào _archive (mặc định chỉ xem trước)")
    clean.add_argument("--yes", action="store_true", help="thực hiện thật")
    clean.add_argument("--caches", action="store_true", help="gồm cả thư mục đệm (scratch, source-bundles, v1export, phase01-source-*)")
    videos = sub.add_parser("videos", help="chép video mới nhất của mỗi job vào một thư mục với tên rõ ràng")
    videos.add_argument("--to", type=Path, default=None, help="mặc định: <project>/videos")
    restore = sub.add_parser("restore", help="khôi phục một lượt dọn")
    restore.add_argument("batch", type=Path)
    purge = sub.add_parser("purge", help="xóa hẳn các lượt trong _archive")
    purge.add_argument("--keep", type=int, default=0, help="giữ N lượt gần nhất")
    purge.add_argument("--yes", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    project = args.project.resolve()
    workspace = (args.workspace or project / ".zodiac-work").resolve()
    if args.command == "restore":
        print(f"Đã khôi phục {library.restore(args.batch)} mục.")
        return 0
    if args.command == "purge":
        base = workspace / library.ARCHIVE_DIR
        batches = sorted((p for p in base.iterdir() if p.is_dir()), reverse=True)[args.keep:] if base.is_dir() else []
        print(f"{len(batches)} lượt sẽ bị xóa hẳn." + ("" if args.yes else " Thêm --yes để thực hiện."))
        if args.yes:
            library.purge_archive(workspace, keep_latest=args.keep)
        return 0
    entries = library.scan(project, workspace, with_sizes=not args.no_sizes)
    if args.command == "list":
        for entry in sorted(entries, key=lambda e: (e.kind, e.group or "", -e.mtime)):
            print(_row(entry))
        print(f"\n{len(entries)} mục · {library.human_size(sum(e.size for e in entries))}")
        return 0
    if args.command == "videos":
        done = library.export_videos(entries, (args.to or project / "videos").resolve())
        for source, target in done:
            print(f"  {target.name}   ← {source.parent.parent.name}")
        print(f"\nĐã chép {len(done)} video." if done else "Không có video mới cần chép.")
        return 0
    moves = library.plan_cleanup(entries, caches=args.caches)
    for move in moves:
        print(f"  → _archive  {library.human_size(move.size):>9}  {move.source.name}  ({move.reason})")
    total = library.human_size(sum(m.size for m in moves))
    if not moves:
        print("Không có gì cần dọn.")
    elif not args.yes:
        print(f"\n{len(moves)} mục ({total}) sẽ được chuyển. Chạy lại với --yes để thực hiện; có thể khôi phục bằng `restore`.")
    else:
        batch = library.apply_cleanup(moves, workspace)
        print(f"\nĐã chuyển {len(moves)} mục ({total}) vào {batch}. Khôi phục: zodiac-library restore \"{batch}\"")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
