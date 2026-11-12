# Kế hoạch dọn thư mục dự án — 2026-11-12

Phạm vi: `E:\projects\project-zodiac-video`. Trạng thái: chỉ khảo sát và lập kế hoạch; chưa xóa, di chuyển hoặc dừng tiến trình.

## Bằng chứng hiện tại

- Main đang có thay đổi GUI/test chưa commit; phải bảo toàn toàn bộ diff và file mới trước khi dọn.
- Kho đọc được 34 mục, 18 job có video, 0 ứng viên từ bộ phân loại hiện tại. Lượt kiểm tra này không hash ZIP và không đo kích thước job; không phải xác nhận không còn file trùng.
- Manifest hiện có tham chiếu renderer 2.0.0, 2.0.1 và 2.0.2. Tên phiên bản cũ không chứng minh có thể bỏ.
- Có tập `processing/bach-duong-20261112-001/workspace` và 4 workspace authoring trong `.zodiac-work/episodes/` cần giữ.
- Các số dưới đây là tổng kích thước logic, không phải dung lượng đĩa chắc chắn thu hồi. Có reparse point bị bỏ qua; `.zodiac-work/_archive` có 4 lỗi đọc nên số đo là cận dưới. Lượt quét gốc `.zodiac-work` hết thời gian; đã đo lại theo từng thư mục con.

## Phân loại toàn bộ thư mục gốc

| Thư mục | GiB logic | Xử lý đề xuất |
|---|---:|---|
| `.agents/` | 0.000 | Giữ hướng dẫn agent. |
| `.claude/` | 0.027 | Có worktree đăng ký; không xóa như cache. |
| `.codegraph/` | 0.082 | Giữ index theo cấu hình của người dùng. |
| `.git/` | 0.017 | Giữ lịch sử Git. |
| `.github/` | 0.000 | Giữ CI/workflows. |
| `.plugin-sync/` | 0.005 | Rà staging với release đang thao tác trước khi lưu trữ. |
| `.pytest_cache/` | 0.000 | Có thể tái tạo sau khi đã dừng test. |
| `.remotion/` | 0.263 | Kiểm tra browser/runtime cache đang dùng; chỉ dọn khi đã dừng render. |
| `.runtime/` | 0.093 | Giữ cấu hình, log cần chẩn đoán và runtime đang dùng; rà cache riêng. |
| `.superpowers/` | 0.001 | Giữ tài liệu/session đang dùng; rà lịch sử riêng. |
| `.venv/` | 0.549 | Giữ môi trường chạy; chỉ tạo lại sau khi kiểm tra dependency. |
| `.worktrees/` | 0.014 | Rà branch/dirty state; dùng git worktree khi đã chốt. |
| `.zodiac-work/` | 3.842 | Giữ job, media và config; rà runtime cũ/archive theo từng nhóm. |
| `assets/` | 0.080 | Giữ nhạc và tài nguyên được tham chiếu. |
| `blocked/` | 0.000 | Giữ bản bị chặn cùng lỗi để có thể điều tra / thử lại. |
| `checklist/` | 0.000 | Giữ tracker, concept/history và review; không suy luận done = đã có MP4. |
| `contracts/` | 0.000 | Giữ contract đang dùng. |
| `docs/` | 0.005 | Giữ tài liệu; retired-source/backups cần kiểm tra tham chiếu trước khi đổi chỗ. |
| `node_modules/` | 0.263 | Giữ dependency đang dùng; kiểm tra hardlink trước khi tính dung lượng thu hồi. |
| `phase1-done/` | 0.000 | Giữ handoff đầu vào bất biến. |
| `plugins/` | 0.287 | Giữ source/asset/contract và plugin tests. |
| `processing/` | 0.012 | Giữ tập đang sản xuất và receipts. |
| `ready/` | 0.002 | Giữ Job@5; đối chiếu job đã nhập trước khi lưu trữ bản ZIP. |
| `runtime/` | 1.938 | Giữ các renderer được manifest tham chiếu (2.0.0/2.0.1/2.0.2). |
| `tests/` | 0.003 | Giữ tests/fixtures; chỉ pycache có thể tái tạo. |
| `tmp/` | 0.000 | Ảnh kiểm tra và inventory mới; chỉ dọn sau khi người dùng xem. |
| `tools/` | 0.077 | Giữ source; chỉ pycache có thể tái tạo. |
| `videos/` | 0.000 | Giữ video xuất cuối. |
| `zodiac_video_local.egg-info/` | 0.000 | Có thể tạo lại bằng cài đặt editable; không ưu tiên vì nhỏ. |

Các file cấu hình ở gốc (`README.md`, `.gitignore`, `.gitattributes`, `package.json`, `pyproject.toml`, `requirements-local.txt`, `uv.lock`, `opencode.json`) giữ tại chỗ. `.env` giữ nguyên, không in nội dung hoặc đưa vào archive chia sẻ.

## Những nhóm cần xem trước

| Nhóm | GiB logic | Điều kiện trước khi dọn |
|---|---:|---|
| `.zodiac-work\.runtime` | 0.002 | Rà nguồn tham chiếu trước; hiện giữ nguyên. |
| `.zodiac-work\episodes` | 0.015 | Giữ authoring, evidence, approvals và hướng dẫn resume. |
| `.zodiac-work\jobs` | 0.000 | Rà nguồn tham chiếu trước; hiện giữ nguyên. |
| `.zodiac-work\plugin-release-2.6.1` | 0.002 | Rà nguồn tham chiếu trước; hiện giữ nguyên. |
| `.zodiac-work\releases` | 0.000 | Rà nguồn tham chiếu trước; hiện giữ nguyên. |
| `.zodiac-work\reviews` | 0.004 | Rà nguồn tham chiếu trước; hiện giữ nguyên. |
| `.zodiac-work\runtimes` | 2.110 | Có 4 runtime legacy 1.15.0/1.16.0/1.20.0/1.21.0. Đối chiếu job/session và launcher trước khi lưu trữ; không bỏ runtime chỉ vì cũ. |
| `.zodiac-work\scripts` | 0.000 | Rà nguồn tham chiếu trước; hiện giữ nguyên. |
| `.zodiac-work\v2` | 0.969 | 19 job; giữ MP4 cuối, giọng, timing, manifest, log và các đầu vào để tái dựng. |
| `.zodiac-work\_archive` | 0.740 | Kiểm tra moved.json, đường dẫn nguồn/đích, xung đột và 4 lỗi đọc; không purge tự động. |

## Thứ tự thực hiện đề xuất

1. **Chốt mốc khôi phục.** Lưu diff/file mới, danh sách worktree, các manifest, cấu hình GUI/checklist/concept và output cuối. Không stash/reset/clean cây đang bẩn một cách tự động.
2. **Cache nhỏ, tái tạo được.** Lập danh sách chính xác `.pytest_cache` và `__pycache__` trong source; chờ test dừng. Giữ ảnh `tmp/` đến khi review xong. Không quét xóa đệ quy theo tên trên toàn repo.
3. **Archive hiện hữu.** Kiểm tra từng batch `.zodiac-work/_archive` (khoảng 0.740 GiB, cận dưới). Đối chiếu manifest và bản video duy nhất; giữ thời hạn khôi phục trước khi xóa vĩnh viễn. Chuyển sang folder khác cùng ổ không giải phóng dung lượng.
4. **Runtime legacy.** Rà `.zodiac-work/runtimes` (khoảng 2.110 GiB). Ghi runtime nào không được job, launcher, session hoặc process nào dùng. Lưu trữ từng phiên bản độc lập và thử mở các job liên quan trước khi cân nhắc bỏ.
5. **Job / ZIP.** Đối chiếu theo job ID, revision và hash. Chỉ lưu trữ bản đã thay thế khi giữ được media duy nhất, input/approval và đường resume. Không dọn `processing`, `phase1-done`, `blocked` theo tuổi file.
6. **Dependency / runtime hiện tại.** `runtime/` khoảng 1.938 GiB; giữ các renderer manifest còn dùng. `.remotion` và `node_modules` mỗi bên khoảng 0.263 GiB logic; kiểm tra file identity/hardlink trước, không cộng hai số thành dung lượng có thể thu hồi.
7. **Worktree và tài liệu.** Worktree Song Tử đã có trạng thái `?? .claude/`; giữ tới khi kiểm tra nội dung mới. Worktree TikTok không có diff trong lượt kiểm tra này nhưng chưa được phép bỏ chỉ vì sạch. Worktree bên ngoài dự án nằm ngoài kế hoạch dọn. Các thư mục `docs/.../retired-source`, backups/reviews chỉ đổi chỗ bằng thay đổi source có kiểm tra tham chiếu.
8. **Xác minh sau mỗi đợt.** Đo dung lượng thực trước/sau; mở GUI, đọc Kho/Checklist/Concept; mở 1 job theo từng renderer còn dùng; kiểm tra MP4 còn tồn tại và hash không đổi. Có lỗi thì khôi phục batch đó trước đợt tiếp theo.

## Nhật ký bắt buộc cho đợt dọn thực tế

Mỗi mục cần đường dẫn tuyệt đối đã kiểm tra nằm trong root, lý do, nguồn tham chiếu đã rà, kích thước, đích lưu trữ, hash của media duy nhất và kết quả khôi phục. Với worktree dùng Git; không Remove-Item vào worktree đăng ký. Không chốt “thu hồi được X GiB” trước khi đo không gian trống thực.

Chưa thực hiện: kiểm chứng hardlink, xử lý 4 lỗi đọc archive, hash toàn bộ media/ZIP, kiểm tra runtime legacy với từng job và thử khôi phục batch. Vì vậy chưa có tổng dung lượng cam kết có thể dọn an toàn.

## Yêu cầu dọn trực tiếp và kết quả thực thi

Người dùng đã yêu cầu xóa gói thấp hơn phiên bản hiện tại, không lưu trữ bản cũ. Đã xác định producer hiện tại 2.9.0 và danh sách 8 ZIP producer thấp hơn, cộng 4 runtime zodiac-remotion 1.x không có job legacy đang dùng. Lệnh PowerShell kiểm tra root/path/reparse và process trước khi Remove-Item đã bị bộ kiểm duyệt tự động chặn trước khi chạy; chưa xóa mục nào. Đây là trở ngại thực thi, không phải thiếu ủy quyền người dùng.

Danh sách đã kiểm tra (tương đối với project root):

- `ready\zodiac-bachduong-di-roi-sao-con-cho.zip` — obsolete-package, phiên bản 2.7.10.
- `ready\zodiac-bocap-im-lang-khong-co-nghia-la-khong-biet.zip` — obsolete-package, phiên bản 2.6.2.
- `ready\zodiac-bocap-kiem-soat-buon-tay.zip` — obsolete-package, phiên bản 2.6.0.
- `ready\zodiac-cugiai-nguoi-bien-su-quan-tam-thanh-cam-giac-o-nha.zip` — obsolete-package, phiên bản 2.6.8.
- `ready\zodiac-plugin-2.6.0.zip` — obsolete-package, phiên bản 2.6.0.
- `ready\zodiac-songngu-absorbs-others-never-claims.zip` — obsolete-package, phiên bản 2.6.0.
- `ready\zodiac-songtu-job5-spatial-fixed.zip` — obsolete-package, phiên bản 2.5.6-dev.7.
- `ready\zodiac-songtu-khi-su-quan-tam-bi-hieu-nham-thanh-mot-loi-hua.zip` — obsolete-package, phiên bản 2.8.8.
- `.zodiac-work\runtimes\zodiac-remotion\1.15.0` — unused-legacy-renderer, phiên bản 1.15.0.
- `.zodiac-work\runtimes\zodiac-remotion\1.16.0` — unused-legacy-renderer, phiên bản 1.16.0.
- `.zodiac-work\runtimes\zodiac-remotion\1.20.0` — unused-legacy-renderer, phiên bản 1.20.0.
- `.zodiac-work\runtimes\zodiac-remotion\1.21.0` — unused-legacy-renderer, phiên bản 1.21.0.

Các renderer zodiac-renderer 2.0.0/2.0.1/2.0.2 vẫn được job hiện tại tham chiếu. Danh sách trên không bao gồm output/media, authoring đang làm, hoặc các renderer này.
