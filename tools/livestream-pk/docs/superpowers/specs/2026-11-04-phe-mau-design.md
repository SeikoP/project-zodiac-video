# Đêm Hội: bỏ cung hoàng đạo, 4 phe màu, tái dùng sự kiện

Trạng thái: **bản nháp chờ duyệt**. Chưa có dòng code nào.

## 1. Mục tiêu

Đêm Hội Hoàng Đạo hiện bắt người xem phải biết cung của mình. Mục tiêu: người xem phổ thông vào phòng là chơi được ngay, không cần biết chiêm tinh.

Thành công khi:
- Người mới comment bất kỳ, thả tim hoặc tặng quà đều có phe và có chỗ trên màn hình trong vài giây, không cần gõ gì.
- Không còn chữ, ký hiệu, câu đố, sự kiện nào trên màn hình mà người không biết chiêm tinh khó hiểu.
- Quà ở mọi sự kiện lớn đều tạo hiệu ứng nhìn thấy được, cố định theo xu, người tặng được xướng tên.
- Mỗi người xem có tiến trình cá nhân (cấp, nhiệm vụ, vai, danh hiệu) giữ qua các đêm.
- Thêm một sự kiện mới chỉ cần khai báo cấu hình trên các khối dựng sẵn, không viết lại khung `start/tick/end`.

### Phạm vi
- **Có:** Đêm Hội Hoàng Đạo (`game.mjs`, `server.mjs`, các module sự kiện, `public/overlay.*`, mascot, nội dung, README).
- **Không:** Vườn Mây (`garden/`, `public/garden/`) giữ nguyên, kể cả 12 đảo theo cung của nó. Không liên quan OBS (`obs/`, `Mo-OBS.bat`, `scripts/setup-obs.mjs`), host dùng TikTok LIVE Studio (xem `CLAUDE.md`). Không đổi `tiktok.mjs` và `diagnostics.mjs`.
- Tên sản phẩm "Đêm Hội Hoàng Đạo" đổi thành **"Đêm Hội Sao"** (không còn chữ "Hoàng Đạo"). Tên thư mục và gói npm giữ nguyên.

### Dữ liệu cũ
Xóa sạch dữ liệu của Đêm Hội, **không viết phần chuyển đổi**: `data/state.json`, `data/backup-night-*.json` và các cài đặt sự kiện đã lưu của game này (`data/settings.json`). **Không đụng** `data/garden-state.json`. Phiên bản lược đồ mới (`schema: 2`) khi gặp tệp cũ thì bỏ qua và khởi tạo mới (không lỗi, có log một dòng). Việc xóa tệp hiện có do người dùng thực hiện hoặc một lệnh `npm run reset-night` ghi rõ tệp nào bị xóa.

## 2. Phe thay cho 12 cung

4 phe, id cố định: `red`, `yellow`, `green`, `blue`, tên hiển thị **Đỏ · Vàng · Xanh lá · Xanh dương**. Mỗi phe có màu, biểu tượng đơn giản (ngọn lửa, lá vàng, lá xanh, giọt nước dùng hình vẽ mới, không dùng ký hiệu cung) và một vai trò nhẹ về thứ tự hiển thị, không có luật riêng như nguyên tố cũ.

- **Vào phe:** gõ **1–4** hoặc tên màu ("đỏ", "xanh lá"…). Cung, số 5–12 và ngày sinh không còn là lệnh vào phe.
- **Tự chia:** người chưa có phe mà comment, thả tim, theo dõi hoặc tặng quà được xếp vào phe **ít người đang có mặt nhất** (hòa thì phe có ít ánh sáng đêm nay hơn). Vì vậy không còn "hàng đợi chờ chọn cung"; sảnh chờ chỉ còn lời chào và 4 ô phe.
- **Đổi phe:** gõ "đổi đỏ" hoặc chỉ gõ tên màu. Lần sửa đầu tiên ngay, các lần sau cách `switchCooldownSeconds` (30 giây). Phe đang bị Boss đóng băng thì không đổi vào/ra được. Giữ luật hiện tại.
- **Cân bằng:** khi một phe đông hơn phe ít nhất quá 2 lần số người, người mới luôn được xếp vào phe ít nhất dù họ gõ phe đông (kèm thông báo "phe đó đã đủ đông, mời bạn sang X"). Có thể đổi sau 30 giây như thường.
- **Mascot:** 4 màu × 5 biểu cảm (`idle, hype, panic, sad, win`) = 20 tệp trong `public/mascots/`, dựng lại bằng `build-mascots.mjs` từ bộ nhân vật của pipeline video, áo in biểu tượng phe. Xóa 60 tệp cung cũ.

## 3. Bỏ, đổi, gọn

### Bỏ hẳn
Chỉ có nghĩa với chiêm tinh hoặc phụ thuộc vào 12 cung:
- Bầu trời thật và chiếu mệnh (`sky.mjs`), Giờ Hành Tinh (`hours.mjs`, `hours-table.mjs`), Thủy Nghịch.
- Cung bí ẩn (theo cung), Bầu trời ngày sinh và lệnh ngày sinh (`birth.mjs`), "Màn lớn" kiểu điểm danh sao theo cung ngày sinh.
- Câu đố, bình chọn, hồ sơ và quẻ phân theo 12 cung (`public/signs.js`, `public/profiles.js`, phần cung trong `quiz.json`, `quizbank.mjs`, `polls.mjs`).
- Bộ thẻ 120 lá, ghép thẻ, pity (`cards.mjs`), Bingo (`bingo.mjs`), vòng ngoài 12 cung, 60 mascot cung.

### Đổi để người phổ thông hiểu
| Cũ | Mới |
|---|---|
| Đua sao 12 cung | **Đua 4 phe** |
| Kéo co cung (2 cung đông nhất) | **Kéo co 2 phe** (2 phe đông nhất, đội ít người kéo mạnh hơn mỗi người, giữ x0,5–x2) |
| Vòng quay bóc phốt theo cung | **Vòng quay may mắn**: quay ra một người đang có mặt, câu trêu vui hiền, "oan"/"chuẩn" giữ nguyên |
| Quẻ hoàng đạo | **Quẻ may mắn**: giữ nhịp xin quẻ và hỏi một chuyện (tình duyên / công việc / tiền bạc), bỏ cung và nguyên tố, còn lời nhắn, màu, số, giờ vàng. Cùng người cùng ngày ra cùng quẻ |
| Cung bí ẩn | **Đoán vật**: giấu một món đồ/con vật quen thuộc, mỗi 10 giây một gợi ý, gõ tên để đoán |
| Câu đố ~390 câu | Ngân hàng **kiến thức chung nhẹ** (Việt Nam, đời sống, vui). Cần viết nội dung mới, tái dùng khung A/B/C 12 giây và 3 người đúng đầu |
| Giờ Hành Tinh | **Màn** chủ đề trung tính (xem mục 5), mỗi lượt 5 phút |
| Đội nguyên tố, "đảo chiều" | Đội 4 phe, "đảo chiều" khi phe khác vượt lên |
| Bụi sao, Sổ Sao | **Điểm sáng**, **Sổ mùa** (một hệ tiến trình) |

Giữ nguyên: Boss (đổi 4 vai nguyên tố thành 4 vai phe, xem mục 4), đèn ước và chúc, rương, trăng rằm, Hành trình đêm (chặng "Đại hội sao" đổi thành "đủ 4 phe sáng"), dự đoán miễn phí, Fanclub, nhiệt phòng, chuỗi đêm, linh vật dẫn chơi, bố cục 1080×1920/chat, âm thanh.

### Gọn hệ thống chồng chéo
Một màn **Kho** duy nhất ("kho" mở): Điểm sáng, cấp linh vật, vật phẩm trong đêm, nhiệm vụ cá nhân. Không còn "khoe thẻ", "sổ sao", "bingo", "ghép thẻ". Giữ **ngọc** (4 loại theo màu phe, thay ngọc nguyên tố) và **mảnh trăng** cho "tung ngọc" và "thắp trăng" như cũ.

## 4. Tái dùng sự kiện

Hiện mỗi sự kiện là một module riêng (`createBoss`, `createTug`, `createRoast`, `createMystery`, `createStarcatch`, `createAltar`, `createJourney`, `createPredict`) cùng bộ khung `start / chat / tick / view / end` và `st.<tên>`; chỉ Boss, Kéo co và Bingo xử lý quà. Thiết kế mới tách thành bốn khối dựng sẵn và ba dịch vụ dùng chung, thư mục mới `events/`.

### 4.1 Bốn khối dựng sẵn

1. **`phase` (vòng đồng hồ):** vòng đời `warmup → run → end → settle` kèm đếm ngược, `nextInMs` cho dòng "sắp tới" và điều kiện nghỉ khi có sự kiện cấp cao hơn. Thay các `start/tick/end` lặp lại. Mỗi sự kiện khai báo thời lượng từng pha, khung xử lý lỗi và `view()` chung.
2. **`meter` (thước đo):**
   - *coop*: một thanh chung (máu Boss, trăng rằm, chặng Hành trình, mục tiêu quà).
   - *versus*: hai hoặc bốn phe kéo thanh (kéo co, đua phe, đảo chiều).
   - Nhận `contribute(user, action, n)` với hệ số theo hành động (comment, like, gift, follow, share) khai báo ở cấu hình, cân bằng phe nhỏ, ghi `power` theo người để tính MVP.
3. **`keywordRound` (vòng gõ từ khóa):** nhận một `match(text)`, cửa sổ thời gian, số người thắng tối đa, mỗi người một lần mỗi vòng, cooldown chung. Dùng cho hứng sao băng, đoán vật, câu đố, "nhận" rương, "chúc" đèn ước, "thuận". Thay cooldown và chống trùng viết riêng ở từng module.
4. **`reactions` (phản ứng và dự đoán):** gom hai nhóm phản ứng ("oan"/"chuẩn" của Vòng quay), dự đoán miễn phí (`đoán A/B`), bình chọn 1–4. Một bộ đếm, một cách chốt kết quả.

### 4.2 Ba dịch vụ dùng chung

- **Roster:** `teamOf(userId)`, `present(team?)`, `counts()`; thay mọi chỗ module tự lọc theo `v.sign`.
- **Thưởng:** một hàm `reward(user, kind, n, why)` với `kind ∈ {light, dust, gem, moon}` (tên cuối cùng theo mục 3), gom việc tính nhiệm vụ cá nhân, MVP, ghi log và (nếu cần) màn mừng. Thay `shine/dust/gem/moon/quest` được truyền vào từng module.
- **Quà:** bộ điều phối ở mục 5.

### 4.3 Cách một sự kiện được khai báo

```js
defineEvent({
  id: 'tug',
  needs: { teams: 2 },            // điều kiện chạy, tối thiểu 2 phe có người
  phases: { warmup: 15, run: 75 },
  meter: { kind: 'versus', teams: 'top2', clamp: 100,
           weights: { comment: 2, like: 0.15, gift: 2.5, follow: 8, share: 8 } },
  reactions: { predict: true },
  gift: { small: ..., mid: ..., big: ... },   // mục 5
  settle: { winner: 20, others: 5, mvpPerTeam: true },
})
```

`game.mjs` giữ danh sách sự kiện và lịch (mục 8); phần luật riêng của từng sự kiện nằm ở tệp của nó, không còn nối thẳng vào `game.mjs`.

## 5. Quà

Một **bộ điều phối quà** (`events/gifts.mjs`) nhận mọi quà. Đầu vào: người tặng, số xu, phe, sự kiện đang chạy. Việc làm, theo thứ tự:

1. Gắn **vầng sáng** vàng cho người tặng 90 giây (`auraSeconds`) và ngôi sao bảo trợ như cũ.
2. Chọn **mức**: nhỏ `< 10` xu, vừa `10–99`, lớn `≥ 100` (ngưỡng đặt trong `config.json`: `giftMid`, `giftBig`).
3. Gọi **khả năng quà** của sự kiện đang chạy ở mức đó (bảng bên dưới). Nếu không có sự kiện nào đang chạy, quà làm phe người tặng sáng thêm một chút và hiện cảnh quà như cũ.
4. Phát **cảnh/banner** có tên người tặng (có hạn ngạch để quà liên tiếp không chặn các cảnh khác).

Hiệu ứng **cố định theo xu, không ngẫu nhiên**. Không có chữ nào trên màn hình xin hay gợi quà (giữ test quét chữ tương tự `garden/copy.test.mjs`). Quà không đổi trực tiếp thành vật phẩm; chỉ tạo hiệu ứng trong lúc sự kiện chạy.

| Sự kiện | Nhỏ (<10 xu) | Vừa (10–99) | Lớn (≥100) |
|---|---|---|---|
| Boss | đòn thêm, tên bay lên | **Đòn tuyệt kỹ**: sát thương lớn cộng khiên cho phe | **Phá băng cả phe** và đánh dấu pha kết liễu |
| Kéo co | giật nhẹ | **Giật mạnh!** có tên người kéo | **Tăng tốc phe 60 giây** |
| Đua phe | +ánh sáng cho phe | **Tăng tốc 30 giây** | **Cả vòng sáng thêm một chặng** |
| Rương | tăng cơ hội nhận cho cả phe | **Mở thêm một rương** | **Rương vàng** cho cả phòng |
| Đèn ước / Trăng | điều ước nhận 1 lời chúc | **Đèn hóa sao vàng ngay** | **Trăng đầy** |
| Vòng quay may mắn | +1 vé quay | người tặng **chọn phe** quay trúng | quay lại cả vòng |
| Hành trình | +đóng góp cho chặng | +nhiều | **Hoàn thành chặng** hiện tại |

Giữ cơ chế người ra **cú kết liễu** được xướng tên. Mọi hằng số (hệ số, thời gian tăng tốc) nằm ở cấu hình sự kiện.

## 6. Lớp cá nhân

Thay cho thẻ, Bingo, ghép thẻ. Lưu theo `userId`, giữ qua các đêm.

- **Cấp cá nhân** từ Điểm sáng. Mỗi cấp mở viền avatar và hào quang linh vật, có "Lv" trên vòng. Giữ hệ số +6%/cấp cho ánh sáng người đó tạo, tối đa Lv5 như "nâng cấp" cũ; chỉnh con số sau buổi diễn tập đầu nếu lệch.
- **3 nhiệm vụ mỗi đêm**, rút từ bể khoảng 15 nhiệm vụ (ví dụ "đánh 5 đòn boss", "chúc 2 điều ước", "có mặt 20 phút", "đoán đúng 1 lần"). Làm xong nhận Điểm sáng và một vật phẩm nhỏ; không có nhiệm vụ nào cần quà.
- **Vai trong phe** theo cách chơi, tính tự động từ hành động đêm đó, không cần chọn:
  - *Chiến binh* (nhiều sát thương/kéo co), *Hộ vệ* (phá băng, khiên), *Cổ vũ* (điều ước, chúc, dự đoán).
  - Vai chỉ cho điểm cộng nhỏ và nhãn trên vòng; không thay đổi luật.
- **Danh hiệu MVP** sau mỗi sự kiện (một người mỗi phe), hiện lên và lưu dạng "MVP Boss ×3". 
- **Hồ sơ:** gõ "hồ sơ" hiện cấp, vai, danh hiệu, chuỗi đêm trong 30 giây/người.
- **Sổ mùa:** giữ 30 cấp theo tháng; bỏ thẻ, khung avatar cấp 10/20/30 giữ lại.
- **Chuỗi đêm** và huy hiệu giữ nguyên.

## 7. Dữ liệu và lược đồ

`st` đổi: `sign` thành `team` (một trong 4), bỏ các trường cung/nguyên tố/hành tinh/thẻ/bingo. Người xem: `{userId, nickname, avatar, team, light, level, role, titles, quests, streak, ...}`. `schema: 2`. Xem mục 1 về xóa dữ liệu cũ. Sao lưu `data/backup-night-N.json` giữ nguyên cách làm (14 bản).

## 8. Lịch sự kiện (Màn thay Giờ Hành Tinh)

Hai hoặc ba **Màn** xoay vòng, mỗi lượt 5 phút (vẫn có phút 0 mở màn, 2,5–4,25 sự kiện chính, 4,25–5 kết màn với MVP). Mặc định:
- **Màn Đấu trường:** Boss tinh anh, Kéo co, Hứng sao băng, Đố nhanh liên hoàn.
- **Màn Hội ngộ:** Vòng quay may mắn, Đoán vật, Mưa rương, Đêm trăng, Chung kết đua phe.

Sự kiện nào cũng chỉ chạy khi `needs` thỏa (ví dụ kéo co cần 2 phe có người). Các hệ số "luật nhân ánh sao theo hành tinh" bỏ; nhiệt phòng và Fanclub giữ làm bội số duy nhất (trần tổng x3 như cũ). `"hours": false` đổi tên thành `"acts": false` (tắt Màn, chạy như cũ).

## 9. Overlay và nội dung

- Vòng giữa chia **4 cung màu** thay 12; linh vật đứng quanh vòng theo phe; bỏ vòng hoàng đạo ngoài, hành tinh, `?planets=1`.
- Cụm giữa luân phiên: chặng hành trình, sự kiện chính sắp tới, bảng đua 4 phe, lời mời vào phe ít người nhất.
- "Cách tham gia" bước 1: **"Comment bất kỳ để vào cuộc, hoặc gõ 1–4 chọn phe"**; bước 2 vẫn là việc nên làm ngay lúc này.
- Bầu trời cộng đồng (sao mang tên người xem) giữ, bỏ liên hệ cung.
- Viết lại toàn bộ chữ trên màn hình, `public/host-prompts.js` (lời dẫn cho host) và README: không còn cung, hành tinh, quẻ "hoàng đạo".

## 10. Kiểm thử

Mỗi giai đoạn có test chạy được (`npm test`, `node --test`):
- Khối dựng sẵn: test đơn vị cho `phase`, `meter` (coop/versus, cân bằng phe nhỏ), `keywordRound` (chống trùng, cooldown, N người thắng), `reactions`.
- Phe: tự chia, cân bằng, đổi phe, đổi bị chặn khi đóng băng.
- Bộ điều phối quà: đúng mức xu → đúng khả năng, không có sự kiện → hiệu ứng mặc định, quà không cộng vật phẩm; test quét chữ: không chữ xin quà.
- Cá nhân: nhiệm vụ, vai, MVP, hồ sơ lưu/nạp lại, `schema: 2` bỏ tệp cũ.
- Hồi quy: `npm run smoke`, `npm run simulator` (300 người xem), `?audit=1` không tràn bố cục; test hiệu năng giữ ngưỡng hiện tại.

## 11. Giai đoạn

Mỗi giai đoạn chạy được trước khi sang giai đoạn sau; test xanh cuối mỗi giai đoạn.
1. **Khối dựng sẵn:** `events/` (phase, meter, keywordRound, reactions, roster, reward, quà, registry), tệp mới, chưa đụng `game.mjs`.
2. **Cắt chiêm tinh:** bỏ bầu trời thật, Giờ Hành Tinh (thay bằng Màn), Thủy Nghịch, ngày sinh, thẻ, Bingo, khi còn 12 cung, để `game.mjs` nhỏ lại trước khi đổi tên.
3. **Đổi `sign` thành `team`:** lược đồ `schema: 2`, 4 phe, tự chia, script xóa dữ liệu cũ.
4. **Chuyển sự kiện lên khối dựng sẵn:** Boss, Kéo co, các sự kiện gõ từ khóa, Vòng quay, dự đoán, bình chọn, đua phe, Hành trình, Quẻ may mắn.
5. **Quà và cá nhân:** bảng khả năng quà, nhiệm vụ/vai/MVP/hồ sơ, Sổ mùa, Kho.
6. **Bề mặt:** overlay 4 phe, mascot, chữ trên màn hình, nội dung mới, README.

(Thứ tự cắt trước, đổi tên sau, khác bản nháp đầu, để việc đổi tên chạm ít mã hơn. Kế hoạch triển khai: `docs/superpowers/plans/2026-11-04-phe-mau.md`.)

## 12. Rủi ro và quyết định chờ kế hoạch

- **Quy mô:** `game.mjs` ~1.600 dòng và `public/overlay.js` ~1.750 dòng đang mang nhiều chữ "sign". Giai đoạn 1 và 2 chạm nhiều dòng; phải làm từng module, test xanh từng bước, không sửa hàng loạt bằng thay thế chữ.
- **Nội dung mới:** ngân hàng kiến thức chung, bể nhiệm vụ, danh sách vật cho "Đoán vật", câu trêu Vòng quay cần viết mới (khoảng 150 câu hỏi, 15 nhiệm vụ, 40 vật, 60 câu trêu); lượng này nên chia nhỏ khi triển khai.
- **Cân bằng phe nhỏ:** hệ số x0,5–x2 và quy tắc cân phe có thể phải chỉnh sau buổi diễn tập đầu.
- **Không làm:** thay đổi tiền, bán thẻ, đặt cược, mua bằng quà; những thứ README đã loại giữ nguyên.
