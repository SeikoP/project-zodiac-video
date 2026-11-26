# Studio Phase 1 trong app: bản nháp, agent theo ý tưởng, vẫn một định dạng ZIP

Ngày: 2026-11-26. Phạm vi: Studio V5 tại worktree main-2. Không thay Phase 1 web, không thay nguồn Phase 1 đã duyệt.

## Ý định và lý do

Hiện Phase 1 chạy ở web rồi đóng thành handoff ZIP, Studio chỉ nhập ZIP. Người dùng gặp ba khó khăn: khó xem diff, khó sửa lẻ vài đoạn, và agent dễ quên context hoặc tạo sai cấu trúc.
Mục tiêu: viết và sửa kịch bản ngay trong Studio, bám ý tưởng đang chọn, nhưng **đầu ra vẫn là đúng handoff ZIP hiện tại và Studio chỉ có một cửa vào là nhập ZIP**. Web và app cùng định dạng nên dùng song song được.

## Mục tiêu / Không phải mục tiêu / Điều phải tránh

Mục tiêu:
- Chọn ý tưởng (concept + cung) trong Ideas, rồi agent viết Phase 1 theo ý tưởng đó.
- Xem diff theo từng đoạn, sửa lẻ một đoạn hoặc một beat mà không làm lại cả bản.
- Xuất ZIP giống hệt định dạng web; nhập ZIP từ web hay từ app đều cho ra cùng một loại episode.
- Agent nhận context chuẩn và đủ, cấu trúc do Core giữ và kiểm.

Không phải mục tiêu: thay Phase 1 web; sửa tại chỗ nguồn đã duyệt; tự động duyệt; build release/installer.
Điều phải tránh: để agent tự do ghi file (lặp lại lỗi hiện tại); tạo đường nhập thứ hai bên cạnh ZIP; mã nào đó tự tạo duyệt thay người dùng.

## Hướng đã chọn (người dùng chọn, mình chốt chi tiết)

Các hướng đã cân nhắc: (A) bản nháp đúng cấu trúc web sửa trong app, (B) chỉ nhập ZIP thành bản nháp, (C) agent tự do viết file kiểu chat. Chọn A, làm B trước. C bị loại vì giữ nguyên lỗi quên context.

### Luồng

```
Ideas (concept + cung) ──► Bản nháp Phase 1 ──► [duyệt trên GUI] ──► ZIP ──► nhập ZIP ──► episode
                              ▲   (sửa, diff)                          ▲
          ZIP từ web ─ mở làm bản nháp mới ┘                  ZIP từ web nhập thẳng như cũ
```

### Bản nháp
- Thư mục nháp nằm trong kho dự án, đúng bố cục web: `narration.txt` và `.authoring/{narrative-plan, episode-scope, phase3-writer-brief, voice-profile, content-review-receipt}.json`. Nhờ vậy xuất ZIP dùng nguyên `export-phase1-handoff.mjs`, không viết bộ đóng gói mới.
- Mỗi lần lưu là một revision (snapshot kèm hash). Diff là diff giữa hai revision, hiển thị theo đoạn lời thoại và theo beat/trường của kế hoạch, không phải diff file thô.
- Mở ZIP web làm bản nháp: giải ra bản nháp mới, ZIP gốc không đổi. Xuất lại ra ZIP có hash mới, nhập thành nguồn mới (không ghi đè nguồn cũ).

### Agent theo ý tưởng
- Chạy lại các bước của `orchestration/phases/01-content.json` (evidence, voice, concept, narrative_design, narration), mỗi bước một nhiệm vụ nhỏ qua `agent_bridge`, giống cách phần hình ảnh chạy từng cảnh.
- Mỗi nhiệm vụ chỉ nhận: thẻ ý tưởng (concept, cung, mô tả từ `idea_catalog.json`), tóm tắt kết quả bước trước, các `load_references` của bước đó, và schema. Danh mục context cho phép/cấm lấy từ manifest bước.
- Core giữ các trường xác định (id, hash, format, cung, concept_code). Agent chỉ viết nội dung. Kết quả đi qua validator Node có sẵn (`validate-episode-concept`, `validateHandoffManifest`, kiểm hiệu suất lời thoại/story visual) trước khi lưu, lỗi trả lại theo trường như `proposals.py`.
- Concept của bước concept được ghim theo ý tưởng đã chọn thay vì để agent thi lại từ đầu.
- Sửa lẻ: sửa một đoạn lời thoại hoặc một beat chỉ làm lỗi thời các bước phụ thuộc (và biên nhận duyệt), không chạy lại cả chuỗi.

### Duyệt và khóa
- Bản nháp sửa tự do. Duyệt chỉ làm được trên GUI, tạo `content-review-receipt.json` gắn với hash lời thoại và kế hoạch hiện tại; mọi sửa sau đó làm biên nhận mất hiệu lực.
- Sau khi nhập, nguồn bất biến như hiện nay. Sửa sau duyệt = bản nháp mới rồi xuất ZIP mới.

### Cổng RPC
Phương thức mới phải thêm vào danh sách cho phép trong `src-tauri/src/lib.rs`.

## Giai đoạn làm

1. **P1a (không agent):** kho bản nháp, mở ZIP làm nháp, trình sửa theo đoạn, diff, xuất ZIP, nhập lại. Kiểm thử vòng ZIP khứ hồi: xuất từ app rồi nhập phải qua validator giống ZIP web.
2. **P1b:** nối Ideas, các nhiệm vụ agent từng bước có validator, sửa lẻ làm lỗi thời đúng phần.
3. **P1c:** gọt giao diện, thông tin hiển thị (nguồn bằng chứng, hạn chế lặp với episode đã xuất).

## Các lựa chọn của mình (để duyệt)

- Nhập từ app đi qua đúng đường ZIP, không gọi tắt vào registry.
- Bằng chứng duyệt: định dạng biên nhận hiện yêu cầu `proof.kind = "user_message"` kèm `ref` và `text`. Mình đề xuất tái dùng định dạng đó với `ref = "studio-gui:<draft_id>:<revision>"` và `text` là nội dung xác nhận người dùng bấm trên GUI, để không đổi hợp đồng web. Nếu bạn muốn một loại proof riêng thì cần sửa validator web.
- Không có chat tự do trong app; chỉnh bằng sửa trực tiếp hoặc chạy lại một bước.

## Việc để người làm quyết định

- Cách biểu diễn diff cho `narrative-plan.json` (theo trường hay theo beat).
- Xử lý khi hai bản nháp cùng ý tưởng và cùng cung.
- Mức nén của thẻ ý tưởng trong prompt để vừa ngân sách context.
