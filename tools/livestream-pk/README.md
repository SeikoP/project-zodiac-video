# Đêm Hội Hoàng Đạo — game tương tác cho TikTok LIVE

Một sân khấu dưới bầu trời sao: người xem bước vào sân bằng linh vật cung của mình, gieo quẻ, thả đèn ước, nhảy, cùng thả tim cho trăng lên rằm, và cùng **đua sao** giữa cả 12 chòm. Game lấy cảm hứng từ hai trend đang hot — **sàn nhạc** (avatar người xem trên sàn, quà kích hoạt hiệu ứng) và **đi chùa online** (từ khoá → nghi thức trên màn hình, gõ mõ bằng tim, xin xăm có tờ giải) — nhưng đặt trong chủ đề chiêm tinh của kênh.

## Cách chơi

| Người xem làm | Trên màn hình | Ánh sao cho cung |
|---|---|---|
| Comment **tên cung**, **số 1–12**, hoặc **ngày sinh** (vd `12/8`) | Linh vật của cung (áo in ký hiệu) bước vào sân, có tên người xem | — |
| Comment bất kỳ | — | +2 (mỗi người 5 giây/lần) |
| **xin quẻ** / gieo quẻ / xin xăm (thêm **tình duyên** / **công việc** / **tiền bạc** để hỏi một chuyện) | Ống quẻ lắc, rồi mở tờ *Quẻ hoàng đạo hôm nay* (tình cảm, công việc, tài lộc, may mắn, lời nhắn, màu · số · giờ vàng); hỏi một chuyện thì chuyện đó lên đầu kèm 2 dòng riêng. Cả phòng gõ **chuẩn** (chủ quẻ +1 bụi sao mỗi người) và, với quẻ Thượng/Đại Cát, **xin vía** (cả hai nhận bụi sao) | +3 |
| **ước …** / mong … / cầu mong … | Một chiếc đèn ước bay lên trời mang dòng chữ của họ | — |
| **kho** / khoe / khoe thẻ / sổ sao | Màn **Kho báu**: cấp linh vật, bụi sao · ngọc · mảnh trăng, 3 thẻ hiếm nhất, số thẻ /120, Sổ Sao, bingo và chi phí lên cấp (mỗi người 30 giây/lần) | — |
| **tung ngọc** (khi có boss hoặc kéo co) | Tiêu 1 viên ngọc (ưu tiên ngọc cung mình): đòn mạnh như một món quà 20 xu, nổ sáng trên sân | — |
| **thắp trăng** | Tiêu 1 mảnh trăng: trăng sáng thêm 20% mục tiêu | — |
| Thả tim | Tim bay lên, **trăng lên dần** (5 tim = 1 ánh sao) | +1 / 5 tim |
| Follow / Share | Chuông sao ngân | +20 (mỗi đêm một lần) |
| Quà < 10 xu | Spotlight + lấp lánh quanh nhân vật | 5 / xu |
| Quà ≥ 10 xu | Pháo hoa, nhân vật nhảy | 5 / xu |
| Quà ≥ 100 xu | **Mưa sao băng** + linh vật khổng lồ | 5 / xu |
| Trả lời câu đố (A/B/C, 12 giây) | 3 người đúng đầu tiên được vinh danh | +40 / +25 / +15 |

**Đua sao (PK nhẹ giữa cả 12 cung, luôn chạy, không cần bấm bắt đầu)**
- Mọi ánh sao người xem tạo ra đều tính vào phần của cung họ trong vòng hiện tại; bảng "Đua sao vòng này" xếp hạng cả 12 cung theo thời gian thực. Cung vượt lên hạng 1 sẽ có thông báo.
- Hết vòng (đủ 12 chòm sáng), cung rực rỡ nhất được **đội vương miện** (đếm theo mùa) và fan đã góp ánh sao nhận **huy hiệu 👑** cùng một ít điểm danh hiệu. Vẫn là hợp tác: ánh sao dư của cung đã sáng chảy sang cung còn tối.
- **Sao may mắn** (mỗi ~100 giây, 20 giây): một cung ở nửa dưới bảng đua được ánh sao x2, để cung nhỏ vẫn có cửa vượt lên. Host có thể gọi thêm bằng nút ở bảng điều khiển.

**Bầu trời ngày sinh, ngôi sao mang tên bạn, màn lớn định kỳ** (`birth.mjs`)
- Comment ngắn là ngày sinh (`12/8`, `12/8/1998`, `12-8-98`, `12 tháng 8 năm 2001`) → màn **"Bầu trời ngày sinh"**: vòng 12 cung thu nhỏ, avatar người xem ở giữa, các hành tinh bay vào đúng vị trí **thật** ngày hôm đó (tính offline như bầu trời hiện tại), kèm 3 dòng: Mặt Trăng (trong lòng), Sao Kim (khi yêu), Sao Hỏa (khi bắt tay vào việc). Chỉ có ngày/tháng thì hiện Mặt Trời và mời gõ thêm năm. **Năm sinh chỉ dùng để tính, không hiện trên sóng và không lưu** (chỉ lưu cung của các hành tinh). Mỗi người một lần mỗi 10 phút (`birthCooldownSeconds`); tắt bằng `"birthSky": false`.
- Ai chọn cung lần đầu được một **ngôi sao mang tên mình** bay xuống "Bầu trời cộng đồng" (phần dưới khung) và ở đó qua các đêm; người đang có mặt thì sao vàng, sáng hơn, tên to hơn. Hiện tối đa `starsShown` (90) sao, ưu tiên người ghé gần nhất.
- **Màn lớn mỗi ~75 giây** (`showEverySeconds`, 0 = tắt) khi sân có người và phòng có hoạt động trong 10 phút gần đây, lần lượt: **điểm danh sao** (sao tên của người đang có mặt bay ngang vòng về chỗ của mình) ↔ **bầu trời ngày sinh** của một người có mặt đã gõ ngày sinh đủ năm (chưa ai gõ thì là mưa sao băng). Đồng hồ đếm ngược ở thẻ trên ("✦ 0:42 · điểm danh sao"). Đang có boss/Thủy Nghịch/quẻ/câu đố thì màn lớn lùi 15 giây.

**Hành trình đêm, đội nguyên tố, kịch tính** (`journey.mjs`)
- **Hành trình đêm 5 chặng**: mỗi đêm là một câu chuyện thay vì các minigame rời rạc — ✨ Tụ hội (5 người chọn cung) → 🌟 Thắp sáng (3 chòm sao) → 🌕 Gọi trăng rằm (1 lần) → ⚔️ Chiến thắng (2 trận: boss, kéo co hoặc tầng trời) → 👑 Đại hội sao (trọn vòng 12 cung). Xong mỗi chặng: màn mừng, cả sân +10 bụi sao (`journeyDust`); xong chặng cuối: mỗi người trên sân +1 mảnh trăng. Sang đêm mới thì bắt đầu lại.
- **Đua phe**: 4 phe Đỏ · Vàng · Xanh lá · Xanh dương đua bằng ánh sao fan tạo ra trong đêm; khi phe khác vượt lên dẫn đầu có thông báo "Đảo chiều!" (cách nhau ít nhất `teamLeadCooldownSeconds`, mặc định 90 giây). Kéo co lật thế cũng có "Đảo chiều!".
- **Cụm giữa = sân khấu chính**: khi không có gì đang diễn ra, vòng tròn giữa không còn mô tả cung hay giải thích hành tinh mà luân phiên: chặng hành trình đang chạy (tiến độ, 5 chấm chặng), sự kiện chính sắp tới và đếm ngược, bảng đua 4 đội nguyên tố, và mời cung còn trống chỗ. Người mới vào nhìn là hiểu cả phòng đang làm gì.
- **Giờ sinh tử**: 10 giây cuối của trận boss, kéo co hay lượt Cung bí ẩn hiện số đếm ngược đỏ thật lớn giữa vòng (có tiếng tích tắc), phần giữa mờ đi.
- **Lời dẫn cho host** (chỉ hiện ở bảng điều khiển, không lên sóng): ô "🎙" trong mục Gợi ý lời dẫn nhận một câu ở mỗi cao trào — boss còn 1/4 máu, 15 giây cuối trận, kéo co đảo chiều, trăng sắp tròn, 30 giây trước sự kiện chính, xong chặng hành trình, đội nguyên tố đổi ngôi.

**Giờ Hành Tinh** (`hours.mjs`, `hours-table.mjs`): mỗi buổi live đi qua các "giờ" chủ đề thay vì mọi sự kiện xoay tua cùng lúc.
- Hiện xoay vòng **2 hành tinh**, mỗi lượt **5 phút** (`"hourMinutes": 5`): ♂ Hỏa → ♀ Kim (`"hourMode": "cycle"`, mặc định). Mỗi lượt là một màn; hai hành tinh gánh đủ **11 sự kiện chính** (Hỏa 5, Kim 6), thay phiên qua từng lượt quay lại (mỗi sự kiện quay lại sau ~50 phút): ♂ Hỏa (đấu trường & thử thách) Boss tinh anh → Kéo co → Hứng sao băng → Thủy Nghịch → Đố nhanh liên hoàn; ♀ Kim (hội ngộ & huyền bí) Đêm se duyên → Bóc phốt → Cung bí ẩn → Mưa rương → Đêm trăng → Chung kết đua sao. Khi Hứng sao băng, Cung bí ẩn hoặc Đố liên hoàn là sự kiện chính, nhiệm vụ giờ đổi theo (sao băng hứng được / trả lời đúng). Thủy và Thổ vẫn có sẵn trong `hours-table.mjs`, thêm vào xoay vòng bằng `"hourPlanets": ["mars","venus","mercury","saturn"]` (hoặc sửa `HOUR_PLANETS`); thêm hành tinh mới thì thêm một mục vào `hours-table.mjs`. `"hourMode": "real"` = theo giờ hành tinh thật (mặt trời mọc/lặn tại `skyPlace`); khi đó Mặt Trời, Mộc, Trăng mượn chủ đề của Hỏa, Kim, Thủy. `"hours": false` = tắt (mọi sự kiện như cũ).
- Mỗi giờ **chỉ cho một số sự kiện tự động** chạy, có **luật nhân ánh sao** riêng (chung trần x3 với bầu trời thật), kiểu màn lớn 75 giây riêng và một **nhiệm vụ giờ**. Lệnh người xem gõ, quà, tim, follow luôn hoạt động ở mọi giờ.

| Giờ | Sự kiện tự động | Luật | Sự kiện chính (thay phiên mỗi màn) | Nhiệm vụ giờ |
|---|---|---|---|---|
| ♂ Sao Hỏa · đấu trường & thử thách | boss, sao may mắn, câu đố | quà · bình luận · câu đố mạnh hơn | Boss tinh anh · Kéo co cung · Hứng sao băng · Thủy Nghịch · Đố nhanh liên hoàn | bình luận |
| ♀ Sao Kim · hội ngộ & huyền bí | sao may mắn, bình chọn | theo dõi · chia sẻ · chuỗi đêm x2 | Đêm se duyên · Vòng quay bóc phốt · Cung bí ẩn · Mưa rương · Đêm trăng · Chung kết đua sao | lời chúc phúc |
| ☿ Sao Thủy · trí tuệ & huyền bí | câu đố, bình chọn, quẻ chung | bình luận · câu đố x2 | Đố nhanh liên hoàn · Thủy Nghịch · Đêm trăng | câu trả lời đúng |
| ♄ Sao Thổ · thử thách | quẻ chung, sao may mắn | thưởng chuỗi đêm x2 | Hứng sao băng · Chung kết đua sao | sao băng hứng được |

- **Màn 5 phút** (một lượt hành tinh): phút 0 mở màn, phút 2,5–4,25 sự kiện chính, phút 4,25–5 **kết màn** với MVP (nhiều ánh sao nhất trong màn, nhận thẻ của giờ) và giới thiệu màn/giờ sau. Sự kiện chính chờ nếu đang có câu đố/bình chọn/quẻ, và không có câu đố/bình chọn nào mở chen vào lúc nó sắp diễn. Thẻ trên ghi "♀ GIỜ SAO KIM · 23:10 · MÀN 2/4", nền trời ngả màu hành tinh; dòng gợi ý đếm ngược "sắp tới: ★ … sau 2:10".
- Bảng điều khiển: chọn giờ (giữ 60 phút) hoặc về xoay vòng tự động, "★ Sự kiện chính ngay", "🕵️ Cung bí ẩn", "🌠 Hứng sao băng", "💞 Ghép đôi", "🔥 Vòng quay bóc phốt", "🪢 Kéo co cung".
- **Mỗi giờ một diện mạo**: quanh vòng tròn giữa là **đồng hồ giờ hành tinh** — màu của hành tinh cai quản rút dần theo thời gian còn lại của lượt, màu hành tinh kế tiếp lấp vào phía sau; huy hiệu ký hiệu hành tinh (kèm "Sao Hỏa · 3:49") nằm ở đầu cung màu, hành tinh kế tiếp chờ ở đỉnh; đổi giờ thì cả vòng lóe màu mới; và "thời tiết" riêng — ♂ tàn lửa bay lên · ♀ tim hồng rơi · ☿ tia chớp quanh vòng · ♄ vành đai nghiêng quanh tâm. (Các chấm hành tinh thật trên quỹ đạo linh vật đã bỏ; thêm `?planets=1` để hiện lại.)
- **Nhiệm vụ giờ** (thay cho thanh "Quà chung"): một mục tiêu cả phòng đạt được chỉ bằng tham gia, theo số người trên sân; đạt thì mọi người có mặt nhận ngọc / bụi sao / mảnh trăng. Quà chung (`giftGoal`) mặc định **tắt**.

**Các cơ chế kết hợp**
- **Vòng quay bóc phốt** (`roast.mjs`): **chính bánh xe 12 cung** quay rồi dừng, cung bị bóc phốt nằm dưới mũi tên ▼ trên đỉnh, vòng tròn giữa đọc câu "phốt" (60 câu); 2,5 giây sau các nút **nhảy về vị trí cũ** (linh vật tạm rời vòng khi đang quay). Fan cung đó gõ **"oan"** để minh oan (+15 ánh sao mỗi người), cung khác gõ **"chuẩn"**; không minh oan được thì cung đó được **sao may mắn an ủi**.
- **Kéo co cung** (`tug.mjs`, sự kiện chính giờ Hỏa): hai cung đông fan nhất kéo một sợi dây sao trong vòng giữa; comment, tim, follow kéo về phía cung mình; đội ít người kéo mạnh hơn mỗi người (x0,5–x2) để vẫn có cửa thắng. Quà là một **"giật mạnh!"** có tên người kéo.
- **Dự đoán** (`predict.mjs`): trước kéo co ("cung nào thắng?"), Hành trình ("đoàn qua tầng 3?") và Boss tinh anh ("hạ được không?"), gõ **"đoán A" / "đoán B"**. **Đoán miễn phí, không đặt cược gì**; đoán đúng được bụi sao (`predictBonus`). (`predictStake` > 0 bật chế độ góp bụi sao chung — mặc định tắt vì dễ bị hiểu là cá cược.)
- **Bingo Hoàng Đạo** (`bingo.mjs`): mỗi người một thẻ 3×3 mỗi đêm (ô giữa "Có mặt"), mỗi ô là một chuyện xảy ra trong phòng (hạ boss, có cặp đôi, bóc phốt, trăng rằm, một món quà xuất hiện, pháo hoa…). Ô được đánh dấu cho mọi người **đang có mặt** khi chuyện đó xảy ra — ở lại lâu là kín thẻ. Mỗi hàng +1 ngọc, kín thẻ +1 mảnh trăng. Gõ **"bingo"** để xem thẻ.
- **Sổ Sao** (`pass.mjs`): sổ theo tháng, 30 cấp, kinh nghiệm = ánh sao bạn tạo ra; mỗi cấp có bụi sao, vài cấp có ngọc/thẻ/mảnh trăng; cấp 10/20/30 có **khung avatar bạc/vàng/Tinh Tú** trên vòng cho hết mùa. Chỉ một nhánh miễn phí, không bán gì. Gõ **"sổ sao"** để xem.
- **Pity thẻ**: 10 lần nhận rương liền không ra thẻ hiếm thì lần sau chắc chắn ra thẻ **Hoàng Kim**; khi còn ≤3 lần, thẻ nhận hiện "còn N lần tới Hoàng Kim".
- **Bộ thẻ**: 5 bản cổ điển + Hoàng Kim + 4 bản Giờ Hành Tinh (30% mỗi lần nhận rương; MVP mỗi màn nhận một lá; giờ Hỏa rơi bản Hỏa hoặc Thổ, giờ Kim rơi bản Kim hoặc Thủy) = **120 thẻ**.

**Quà tặng trong game (không xin quà)**: không chữ nào trên màn hình bảo người xem tặng quà; hướng dẫn chỉ nhắc comment và thả tim. Quà vẫn có tác dụng lớn và được ghi nhận, nên ai tặng cũng thấy rõ giá trị:
- người tặng có **vầng sáng vàng** quanh linh vật 90 giây (`auraSeconds`) và **ngôi sao bảo trợ** to hơn, viền vàng trong Bầu trời cộng đồng (theo tổng xu trọn đời: 10 / 100 / 1.000);
- quà là đòn mạnh nhất ở boss, Hành trình, kéo co; người ra **cú kết liễu** được xướng tên; kéo co có "giật mạnh!";
- quà tạo ánh sao, ánh sao là kinh nghiệm Sổ Sao; Bingo có ô "Một món quà xuất hiện" / "Pháo hoa rực trời" (đánh dấu cho cả phòng, không riêng người tặng).
Thẻ bài, Sổ Sao và dự đoán **không bao giờ đổi trực tiếp bằng quà**.
- **Câu đố dễ hơn**: 2/3 câu là loại nhìn là biết (ký hiệu ♌ là cung nào, 🦀 là cung nào, nguyên tố, ngày sinh, thứ tự).

**Hai sự kiện ngắn** (`minigames.mjs`, thay cho Hành trình Tầng Trời kiểu roguelike — quá nhiều luật cho một phòng live):
- **🕵️ Cung bí ẩn** (giờ Kim): một cung bị giấu, cứ 10 giây hiện thêm một gợi ý (nguyên tố → tính chất → hành tinh chủ quản → biểu tượng → ngày sinh). Gõ **tên cung** để đoán, mỗi gợi ý được đoán một lần, đoán không làm đổi đội. 3 người đúng đầu tiên nhận ngọc (2 · 1 · 1); hết gợi ý thì lộ đáp án.
- **🌠 Hứng sao băng** (giờ Hỏa, Thổ): 8 ngôi sao băng, mỗi ngôi mang một chữ ("lộc", "trăng", "vui"…). Gõ đúng chữ đó thật nhanh — 3 người đầu tiên hứng được (+3 bụi sao, +ánh sao); ai hứng nhiều nhất cả lượt nhận 1 ngọc.

**Bố cục theo màn hình TikTok**: trên điện thoại cao, TikTok đặt luồng 9:16 sát đáy và **khung chat che khoảng 37% dưới** (từ y≈1200 của khung 1080×1920). Mọi thứ cần đọc nằm trên vạch đó: thẻ trên (có thêm dòng **Quà chung** mỏng ở cuối thẻ), bánh xe tự thu nhỏ cho vừa (y 330–1192). Phần dưới chỉ là Bầu trời cộng đồng (trang trí, bị chat che vẫn không sao). Dải đen phía trên trong app TikTok nằm **ngoài** khung hình phát nên overlay không vẽ vào được; muốn lấp nó thì phải phát khung cao hơn (1080×2400, dùng `?phone=1`) nếu LIVE Studio cho chọn kích thước đó.

**Giữ chân người xem**
- **Chuỗi đêm**: quay lại đêm liền kề thì được thưởng ánh sao ở hành động đầu tiên (5 × số đêm liên tiếp, tối đa 40) và hiện thông báo "trở lại · chuỗi N đêm". Bỏ lỡ một đêm thì chuỗi về 1.
- Huy hiệu 👑, danh hiệu và bảng mùa giữ qua các buổi live; đếm ngược "sao may mắn sau …" luôn hiện để người xem có lý do ở lại.

**Bầu trời thật** (`sky.mjs`, thư viện `astronomy-engine`, tính offline)
- Server tính vị trí **thật** của Mặt Trời, Mặt Trăng, Sao Thủy, Kim, Hỏa, Mộc, Thổ trên vòng hoàng đạo mỗi phút, hành tinh nào đang **nghịch hành (℞)**, pha trăng và lúc Mặt Trăng sang cung kế tiếp. Dải dưới thanh tiến độ hiện "☉ Bọ Cạp · ☿ Bọ Cạp ℞ · …"; ký hiệu hành tinh cũng gắn lên đúng cung trên bánh xe, và tâm vòng thỉnh thoảng giải thích "Sao Thủy ở Bọ Cạp — fan Bọ Cạp: bình luận x2".
- **Chiếu mệnh**: fan của cung có hành tinh đứng được nhân ánh sao cho đúng loại hành động hành tinh đó cai quản — Mặt Trời: mọi hành động x1.5 · Mặt Trăng: thả tim x2 · Sao Thủy: bình luận/câu đố/bình chọn x2 · Sao Kim: theo dõi/chia sẻ x2 · Sao Hỏa: quà x1.5 · Sao Mộc: mọi hành động x1.25 · Sao Thổ: thưởng chuỗi đêm x2 (cộng dồn, tối đa x3). Đêm **trăng tròn thật** thì trăng trong game lên nhanh gấp đôi. Tắt bằng `"skyBoons": false`.

**Thủy Nghịch** (hỗn loạn có kiểm soát)
- Trong ~40 giây, ánh sao của mọi người **đi lạc sang cung đối diện** (Sư Tử → Bảo Bình…), cả ở bảng đua lẫn bầu trời: bánh xe quay ngược, màn hình ngả tím, sao chổi bay chéo vòng. Cả phòng gõ **“thuận”** (hoặc “sửa sóng”) — đủ số người (nửa số người trên sân, tối thiểu 3) là sửa xong, mỗi người sửa được +5 ánh sao.
- Khi **Sao Thủy nghịch hành thật** thì đến khoảng mỗi 8 phút (và overlay ghi rõ "Sao Thủy đang nghịch hành thật"); ngoài đợt đó khoảng mỗi 25 phút. Host gọi/dừng bằng nút ☿ ở bảng điều khiển. `chaosEverySeconds`, `chaosEveryRetroSeconds` = 0 để chỉ gọi tay.

**Boss Sao Chổi Đen** (cả phòng cùng đánh, ~2,5 phút, khoảng mỗi 10 phút khi phòng có người)
- Máu theo số người trên sân. Comment, thả tim, tặng quà, follow/share đều gây sát thương; mỗi **nguyên tố** một vai: **Lửa** quà chí mạng x2 · **Đất** mỗi comment +1 khiên · **Khí** comment liên tục tạo combo (tới +150%) · **Nước** thả tim sát thương x3.
- Mỗi ~22 giây (dưới 1/3 máu: ~14 giây) boss **đóng băng** cung đang đánh mạnh nhất: cung đó không gây sát thương cho tới khi đủ fan của chính cung đó comment để phá băng (1–3 người); không ai cứu trong 12 giây thì boss hồi 12% máu. Khiên đủ 10 thì chặn đòn thay vì bị đóng băng.
- Thắng: ai góp sức cũng +30 ánh sao và **1 thẻ**; MVP nhận thẻ **Diệt Sao Chổi**; overlay vinh danh MVP từng nguyên tố. Hết giờ: boss trốn thoát. Trong lúc đánh boss, quẻ chờ tới sau trận.

**Rương sao & bộ thẻ Hoàng Đạo** (giữ chân trong buổi và kéo quay lại)
- Rương mở đúng **:00, :15, :30, :45** (đồng hồ đếm ngược luôn ở góc trên), mở 25 giây; gõ **“nhận”** để lấy 1 thẻ — chỉ người đang có mặt mới lấy được. Không ai hoạt động 10 phút thì rương bỏ lượt.
- 60 thẻ = 12 cung × 5 bản: Thường · **Tinh Tú** (hiếm) · **Thủy Nghịch** (ánh kim, chỉ rơi khi đang Thủy Nghịch hoặc Sao Thủy nghịch hành thật) · **Trăng Tròn** (ánh kim, chỉ đêm trăng tròn thật) · **Diệt Sao Chổi** (MVP boss). Gom đủ 12 cung được vinh danh. Gõ **“khoe thẻ”** để bộ sưu tập hiện lên sóng (mỗi người 1 lần/phút). Thẻ **không bán**, không đổi bằng quà.

**Kho tài nguyên & nâng cấp linh vật** (`bag.mjs`)
- Mỗi người xem có kho riêng, giữ qua các đêm: **✦ Bụi sao** (rơi theo mọi ánh sao bạn tạo ra), **4 loại ngọc nguyên tố** — Hỏa · Thổ · Phong · Thủy (đánh boss: 2 viên, MVP 4 · nhận rương: 1 · trả lời đúng câu đố: 1 · sửa sóng Thủy Nghịch: 1, luôn là ngọc của nguyên tố cung bạn) và **🌙 Mảnh trăng** (có mặt lúc trăng rằm, hoặc điều ước được cả phòng chúc phúc).
- Gõ **“nâng cấp”**: tiêu bụi sao + ngọc (+ mảnh trăng từ Lv4) để linh vật lên **Lv2 → Lv5**. Linh vật to hơn, có hào quang màu theo cấp trên vòng, avatar có viền và nhãn "Lv", và mọi hành động được thêm 6% ánh sao mỗi cấp. Thiếu thì hiện "còn thiếu …". Gõ **“kho”** (hay “khoe”, “khoe thẻ”, “sổ sao”) để mở **một kho chung** gồm tài nguyên, thẻ, Sổ Sao và bingo; tài nguyên dùng được trong các sự kiện (“tung ngọc”, “thắp trăng”); **“ghép thẻ”** đổi 3 thẻ Thường giống nhau thành 1 thẻ Tinh Tú.

**Đèn ước có lời nhắn và được chúc phúc**
- “ước …” thả một **đèn lồng giấy có ghi lời ước** (bỏ chữ "ước" ở đầu), avatar và tên người ước bay chậm qua bầu trời; dải "Điều ước" ở khung dưới giữ 3 điều ước gần nhất.
- Trong 45 giây, người khác gõ **“chúc”** để chúc phúc (mỗi người +3 bụi sao). Đủ 3 lời chúc thì đèn hóa sao vàng, có màn chúc mừng ghi lời ước và tên những người chúc, người ước nhận 1 mảnh trăng. Bước 2 của "Cách tham gia" tự đổi thành "Gõ “chúc”" lúc đó.

**Đổi cung**: ai đã có cung thì giữ cung đó; bình luận có tên cung khác ("Sư Tử đỉnh quá") **không** làm đổi đội. Muốn đổi thì gõ **"đổi Sư Tử"**, "đổi sang 7", "chuyển qua cung Bảo Bình", hoặc chỉ gõ đúng tên cung. Lần sửa đầu tiên (chọn nhầm) được đổi ngay; các lần sau cách nhau 30 giây (`switchCooldownSeconds`) để không nhảy cung đuổi theo sao may mắn; cung đang bị boss đóng băng thì không đổi được. Màn hình xác nhận "đổi cung A → B".

**Lời chào ghé thăm**: người vừa vào phòng được chào giống một điều ước nhưng bằng **ngôi sao giấy phát sáng** (không phải đèn lồng) bay lên, mang dòng "Chào <tên>! · vừa ghé đêm hội ✨" và bộ đếm "gõ “chào” 0/3". Cùng lúc **ngôi sao của họ (có avatar) xuất hiện ở rìa quỹ đạo quanh bánh xe**, giữa màn hình, nên ai cũng thấy mình vừa "xuất hiện". Mỗi lời "chào" làm sao lóe sáng; trong 30 giây (`welcomeWindowSeconds`), đủ 3 người khác gõ "chào" / "xin chào" / "hi" / "hello" / "welcome" (`welcomeNeed`) thì sao bừng vàng, người mới nhận +5 bụi sao (`welcomeDust`). Hết lượt chào, sao bay xuống chỗ của nó ở bầu trời cộng đồng. "chào" đi tới người mới nhất còn mở; mỗi người chào một lần, không tự chào mình.

**Fanclub**: thư viện TikTok gửi kèm cấp fanclub của phòng (`user.fansClub`) và cờ người đăng ký. Thành viên fanclub/người đăng ký: màn chào riêng lần đầu mỗi đêm ("♥ FANCLUB … · LV n — X đã đến!"), avatar viền vàng kèm nhãn ♥cấp trên vòng, khung "Fanclub có mặt" ở góc phải dưới vòng, **+10% ánh sao (+1%/cấp, tối đa +30%)**, người đăng ký +10%, và đặc quyền **"gọi sao"**: gọi sao may mắn cho cung của mình, một lần mỗi đêm. Người không ở fanclub gõ "gọi sao" sẽ thấy lời mời tham gia fanclub. Khi diễn tập, cứ người xem giả lập thứ 7 là thành viên fanclub để xem trước giao diện.

**Nhiệt phòng**: tổng hoạt động của cả phòng trong 20 giây gần nhất (mỗi người tối đa 6 điểm / 2 giây, nên một người spam không đủ làm nóng). Bậc Yên ả → Ấm lên x1.1 → Nóng x1.25 → Bùng cháy x1.5 → Siêu tân tinh x2 ánh sao cho mọi người; lên bậc có thông báo trên màn hình.

**Linh vật dẫn chơi (khi phòng im)**: thay vì bot giả làm người xem (TikTok coi tương tác giả là vi phạm, và người xem phát hiện ra thì mất lòng tin), 3/8 lượt lúc phòng im là **linh vật của kênh làm mẫu một lệnh**, có nhãn "🎓 linh vật dẫn chơi": vào đội, ước (thả "đèn mẫu của linh vật"), xin quẻ, nâng cấp, chúc, nhận rương, đổi cung. Khi chưa ai vào vòng, linh vật hiện ở khung chào của hàng đợi. Tắt bằng `"demoTurns": false`.

**Cách tham gia ở trên cùng**: bước 1 luôn là "Comment tên cung hoặc ngày sinh"; bước 2 là việc nên làm *ngay lúc này* (đánh boss, gõ "nhận" khi rương mở, gõ "thuận" khi Thủy Nghịch, gõ "chúc" khi có điều ước), lúc yên thì xoay vòng qua các lệnh.

**Vòng ngoài = vòng hoàng đạo**: mỗi cung có một cung tròn màu sáng dần theo ánh sao cả đội góp (đủ thì phát sáng), và **các hành tinh thật** đứng trên vòng đúng kinh độ hiện tại (viền tím + ℞ khi nghịch hành). Người xem đứng ngoài vòng bằng linh vật của cung kèm **avatar TikTok** của chính họ (người diễn tập hoặc không có ảnh thì hiện chữ cái đầu trên nền màu). Hàng đợi khi chưa ai vào vòng và lời chào người mới cũng dùng avatar thật.

**Hình vẽ mới** (`public/art/`): đèn lồng, rương sao (đóng/mở), Sao Chổi Đen, 4 viên ngọc nguyên tố, bụi sao, mảnh trăng — nét mực trên giấy như bộ linh vật. Trong lúc đánh boss, các màn chúc mừng khác thu về dải thông báo để không che vòng đấu; boss bắn tia vào cung bị đóng băng và cả khung rung lên.

**Icon khớp với TikTok**: phần hướng dẫn và thông báo dùng đúng biểu tượng các nút bên phải màn hình TikTok LIVE (bình luận, thả tim, tặng quà, theo dõi, chia sẻ) và đơn vị "xu".

**Mục tiêu chung**
- **12 chòm sao** sáng dần theo ánh sao của cộng đồng; đủ sao → chòm sao *thức giấc*. Cả 12 sáng → vòng hoàng đạo trọn, mở vòng mới lớn hơn.
- **Trăng rằm**: cả phòng cùng thả tim/tương tác để trăng tròn → 40 giây ánh sao x2.
- **Danh hiệu** trọn đời: Tân Tinh → Sao Sáng → Tinh Vân → Thiên Hà. Bầu trời, huy hiệu và danh hiệu giữ qua các buổi live; mỗi buổi bấm **Bắt đầu đêm mới** để làm lại trăng và các mốc follow/share.

## Âm thanh, nhạc nền và khoảnh khắc ăn mừng

- **Nhạc nền xoay vòng**: 19 bài toàn vui nhộn, sôi động (khoảng 40 phút) — 16 bài Mixkit trong `assets/music/livestream/upbeat/` (6 bài pop/EDM và 10 bài vui như *Comical*, *Kidding Around*, *Fun Jazz*, *Banjo Man in Africa*) cộng 3 bài vui sẵn có của kênh (`andriih-fun`, `andriih-funny`, `alex-morgan…blooper-comedy`). Đã bỏ nhóm nhạc nhẹ; hai bài `background.mp3` và `mixkit-secret-garden` của kênh bị loại khỏi live bằng `musicExclude` (vẫn dùng cho video). Chuyển bài bằng cross-fade 3,5 giây, không lặp cùng một bài hai lần liên tiếp, tự **giảm nhỏ** khi có hiệu ứng lớn (mưa sao băng, pháo hoa, trăng rằm, hoàn thành vòng…). Thư mục `calm/` và `upbeat/` quyết định nhóm (hiện chỉ dùng `upbeat/`); file lẻ ở `assets/music` thì tên có chữ `fun` là sôi động, `comedy`-only/`sfx` có thể bị bỏ qua. Chỉnh bằng `musicDir`, `musicExclude`, `musicUpbeat` trong `config.json`.
- **Gói âm thanh miễn phí** (`audio-pack.json`): 14 bài nhạc + 16 hiệu ứng thu thật từ [Mixkit](https://mixkit.co/license/) (giấy phép Mixkit Free: dùng miễn phí kể cả thương mại, không cần ghi nguồn; **không** đăng ký Content ID, không bán lại/phát tán nguyên bản). Mình chưa đọc được nguyên văn giấy phép (trang tải bằng JavaScript), nên bạn hãy đọc một lần ở liên kết trên. Danh sách bài, tác giả, ID và nơi dùng nằm ở `assets/music/livestream/LICENSES.md` và `public/sfx/LICENSES.md`. Các file mp3 không được đưa vào git (bị `.gitignore` loại): trên máy khác chạy `npm run audio` để tải lại (~84 MB), hoặc `npm run audio -- --from <thư mục>` để chép từ bản đã tải.
- **Hiệu ứng âm thanh cho các sự kiện mới** (19 bản thu Mixkit thêm vào `audio-pack.json`, tải bằng `npm run audio`): chuông thiên thể đổi giờ, kèn mở màn, trống dồn sự kiện chính, hoàn thành màn, chuông ghép đôi, sao bay, mở rương, trống boss, đòn trúng, cửa đá, nhận ấn, đoàn bị đánh, gục ngã, hồi sinh, máy quay vòng, "ba-dum-tss" bóc phốt, tiếng cả phòng cười, trống chiến thắng, lật thẻ.
- **Hiệu ứng âm thanh**: lấp lánh, pháo hoa, mưa sao băng, chòm sao sáng, hoàn thành vòng, mốc người ghé thăm, lên danh hiệu, trăng rằm, mở quẻ, sao may mắn, câu đố đúng và bình chọn dùng **bản thu thật**; các âm còn lại (nốt riêng mỗi cung khi vào vòng, tim, nhảy, combo, đếm giây, follow, share…) là âm tổng hợp ~30 loại. Thiếu file nào thì tự dùng bản tổng hợp. Giới hạn 8 âm mỗi giây.
- `?sfx=0` tắt hiệu ứng, `?sfx=0.5` chỉnh âm lượng; `?music=0` tắt nhạc, `?music=0.3` chỉnh âm lượng. Bảng điều khiển có nút **Bài khác** và **Tắt/bật nhạc**. Overlay không hiện nút bật nhạc (người xem không bấm được). Khi thử trong trình duyệt thường mà bị chặn tự phát, bấm một lần vào trang, hoặc thêm `?soundbtn=1` để hiện nút; trong OBS không bị chặn. Trong OBS tick **Control audio via OBS** (bản import sẵn đã bật) để tiếng vào luồng phát.
- **Mốc người ghé thăm**: người đầu tiên (có lời chào riêng), 10, 25, 50, 100, 200, 300, 500, 1.000… mỗi đêm có thông báo ăn mừng.

## Khi phòng vắng hoặc ít người

- Mỗi cung chưa có người xem vẫn hiện **linh vật của chính cung đó** (ghi tên cung, không giả làm người xem), và dòng chào "Comment số 1–12 hoặc tên cung để bay vào vòng".
- **Mục tiêu tự co theo số người** (`adaptiveCrowd`): vòng hoàng đạo và mục tiêu trăng tính theo số người đang có mặt (tối thiểu 20%, đủ 100% từ 12 người), nên 1–3 người vẫn thấy tiến triển; phòng đông thì mục tiêu lớn dần.
- 45 giây không ai tương tác → tự luân phiên, chủ yếu là **quẻ chung cho một cung**; **câu đố** và **bình chọn vui** mỗi thứ chỉ 1 lần trong 8 lượt (≈6 phút) để nhường chỗ cho quà, cung sáng và các sự kiện khác ("Cung nào nấu ăn ngon nhất?", 30 câu trong `polls.mjs`). Bình chọn bằng cách comment tên cung; ai đã có đội thì không bị đổi đội, mỗi người một phiếu, mỗi phiếu +3 ánh sao. Host cũng bấm được **Bình chọn vui** bất cứ lúc nào.
- Thẻ cung rotating ở giữa vòng (5 câu tính cách + 3 thẻ kiến thức mỗi cung) và đồng hồ "sao may mắn sau …" luôn chạy.
- Không tạo người xem hay quà giả trên sóng.

## Nội dung phong phú, ít lặp

- **Câu đố ~390 câu**: gần 20 dạng sinh tự động từ dữ liệu 12 cung — nguyên tố, biểu tượng, chủ tinh, nhóm tính chất, cung đối diện, thứ tự, cung kế tiếp, ngày sinh, tên tiếng Anh, cung hợp, **điểm mạnh, "cung nào hay…" (48 tật dễ thương), nghề hợp, và 60 câu "câu này hợp với cung nào?"** — cộng 72 câu viết tay (kiến thức chiêm tinh, 12 con giáp và năm âm lịch, hành tinh/trăng/nhật nguyệt thực, biểu tượng cung, ngày lễ Việt Nam rơi vào cung nào). Xáo thứ tự mỗi lần chạy; hai câu cùng dạng không liền nhau; đáp án A/B/C phân bổ đều.
- **Hồ sơ từng cung** (`public/profiles.js`): mỗi cung có 4 điểm mạnh, 4 tật dễ thương, 3 kiểu yêu, 3 nghề hợp — vừa làm câu đố vừa làm thẻ ở giữa vòng lúc phòng vắng. Mỗi cung có 5 câu tính cách + 7 thẻ kiến thức xoay vòng, và mỗi lượt đọc lại lấy phần khác nên không lặp nguyên văn.
- **Quẻ hoàng đạo**: mỗi mục (tình cảm, công việc, tài lộc, may mắn) lấy từ 3 kho — riêng từng cung, theo nguyên tố, và chung (24 câu/kho chung) — cộng 40 lời nhắn, màu, số, giờ vàng. Cùng người cùng ngày luôn ra cùng quẻ; hai cung khác nhau hiếm khi trùng câu.
- **Bình chọn 1–4**: mỗi câu có 4 lựa chọn đánh số, comment **1, 2, 3 hoặc 4** để bầu (mỗi người một phiếu; số không làm ai vào hay đổi đội trong lúc bình chọn). 70 câu "Cung nào … nhất?" mỗi lần bốc 4 cung; cứ 3 lần bình chọn thì có 1 lần **"Cả phòng chọn màn tiếp theo"** — sự kiện chính được bầu sẽ diễn ra ở lượt kế tiếp của hành tinh kia (`pollNextEvery`).
- **Theo ngày lễ** (`public/occasions.js`): Tết Dương lịch, Valentine, 8/3, 30/4, 1/5, 1/6, 2/9, 20/10, Halloween, 11/11, 20/11, Giáng sinh, Black Friday, Tết Nguyên Đán và Trung thu (bảng ngày âm lịch đến 2030). Vào ngày đó overlay hiện lời chúc, dòng đầu ghi tên ngày lễ, và 35% lượt quẻ dùng lời nhắn riêng của ngày lễ.
- **Gợi ý lời dẫn cho host** (bảng điều khiển → "Gợi ý lời dẫn"): 58 câu theo 7 tình huống — mở đầu, giữ chân, cảm ơn, chơi cùng từng cung, phòng vắng, chuyển cảnh, kết thúc. Chọn nhóm rồi bấm "Gợi ý khác" (không lặp đến khi hết nhóm), có nút sao chép. Viết theo hướng cảm ơn chứ không xin quà, vì TikTok xem việc dụ dỗ tặng quà là vi phạm điều kiện kiếm tiền.
- Dữ liệu tham chiếu (`public/signs.js`) đối chiếu nhiều nguồn tiếng Việt; vì ngày sinh lệch ±1 ngày giữa các nguồn, câu đố chỉ hỏi những ngày nằm giữa khoảng. Màu/số may mắn, cung hợp, tính cách và nghề chỉ mang tính giải trí.

## Chuẩn bị live (làm một lần, rồi mỗi buổi chỉ cần 1 lệnh)

```bash
cd tools/livestream-pk
npm install
npm run setup -- ten_tiktok_cua_ban     # tạo config.json + kiểm tra
npm run live                            # kiểm tra, chạy server, mở bảng điều khiển
```

- Bắt đầu đêm mới: `npm run reset-night` (chạy thử, chỉ liệt kê) rồi `npm run reset-night -- --apply` để xóa `state.json`, `backup-night-*.json`, `settings.json` (giữ nguyên dữ liệu vườn).

- `npm run check` kiểm tra Node, thư viện, config (khoá gõ sai, sai kiểu), câu đố, 60 hình linh vật, font, cổng, quyền ghi dữ liệu và người xem diễn tập còn sót lại. Thêm `-- --online` để hỏi TikTok xem tài khoản có đang live không. Có lỗi ✖ thì `npm run live` từ chối chạy.
- Overlay: trong TikTok LIVE Studio, thêm nguồn Web/Browser/Link tới **`http://127.0.0.1:4848/`** (`?safe=1` cũ giờ không còn tác dụng: bố cục mặc định đã chừa chỗ cho chat TikTok). Bố cục khung cao dùng `?phone=1` với nguồn 1080×2400; khung live và nguồn phải cùng tỷ lệ.

**Bố cục 1080×1920:** **thẻ trên cùng** (y 20–~320: tên đêm, rương, trăng, đồng hồ màn lớn, cách tham gia, top 3, dòng gợi ý, điều ước, Quà chung); **bánh xe** thu theo hệ số `Z` cho vừa y 330–1192 (bánh xe dựng trong hệ 1016×1050 riêng, `LAYOUT`/`Z`/`at()`/`local()` trong `overlay.js`); **thẻ sự kiện** nằm giữa vòng; từ y 1210 trở xuống là **Bầu trời cộng đồng** (khu bị chat che). `?phone=1` cùng cách chia cho khung 1080×2400 (thẻ trên từ y 345 vì đầu khung nằm dưới thanh tiêu đề TikTok, bánh xe 662–1672, bầu trời từ 1700).

**Quà tặng.** Quà nhỏ hiện thẻ vàng 150px (ảnh quà lắc lư, tên quà cỡ lớn, avatar + tên người tặng, bong bóng combo); quà từ `fireworkDiamonds` xu trở lên chiếm cả bánh xe. Ngoài ra có **Quà chung**: mọi quà trong đêm cộng dồn vào một thanh mục tiêu (`giftGoal` = 30 xu, mỗi lần đạt mục tiêu sau lớn gấp `giftGoalGrowth` = 1.4) — đầy thì cả phòng được một màn **mưa sao băng**. Dưới thanh có tổng quà đêm nay, người tặng nhiều nhất và 3 quà gần nhất (ảnh quà lấy từ TikTok).

**Sảnh chờ.** Khi chưa ai chọn cung, thay cho bánh xe là một layout riêng: thẻ chào (chào đích danh người vừa ghé, kèm số người ghé đêm nay), **Hàng đợi vào vòng** (8 chỗ theo thứ tự đến — người đã comment/thả tim/tặng quà mà chưa gõ tên cung; chỗ chưa có ai để nét đứt) và 12 ô cung để chọn. Ai gõ số 1–12 hoặc tên cung thì rời hàng, bánh xe hiện ra; sau đó dòng mục tiêu vẫn báo "n bạn đang chờ chọn cung". Người im quá `presenceMinutes` tự rời hàng.

**Tham số overlay:** `?transparent=1` (nền trong suốt, đặt lên camera) · `?fps=30` · `?voice=1` (đọc quẻ bằng giọng vi-VN của máy) · `?audit=1` (tự kiểm tra tràn bố cục: báo lỗi trong khung đỏ ở góc trái, chỉ dùng khi thử).

**Cài sẵn cho Windows:** bấm đúp `Mo-Live.bat` (cài thư viện lần đầu, kiểm tra, chạy server, mở bảng điều khiển) và `Doi-tai-khoan.bat` (nhập username TikTok). `config.json` đã được tạo sẵn với cấu hình mặc định.

**OBS đã cài sẵn (bản portable 33.0.1 tại `%LOCALAPPDATA%\Programs\obs-studio`, không cần quyền quản trị):** bấm đúp `Mo-OBS.bat` để mở với profile và cảnh Zodiac Live. Nếu muốn dùng bản cài thường thì tải từ obsproject.com rồi chạy `npm run obs`.

**OBS (Windows, tự động):** `npm run obs` tạo profile **Zodiac Live** (1080×1920, 30 FPS, 4500 kbps) và nhập cảnh dựng sẵn vào `%APPDATA%\obs-studio` (chỉ thêm file mới, không đụng stream key hay profile cũ; thêm `-- --force` để ghi đè). Stream Key TikTok bạn tự dán ở Settings ▸ Stream.

**TikTok LIVE Studio:** trong scene đang live, thêm nguồn **Web/Browser/Link** với URL `http://127.0.0.1:4848/`. Nếu LIVE Studio cho đặt canvas dọc tùy chỉnh 9:20, dùng `http://127.0.0.1:4848/?phone=1` và đặt cả canvas lẫn nguồn ở **1080×2400**; nếu canvas vẫn là 9:16, nguồn cao hơn sẽ bị co hoặc cắt theo canvas.

**OBS (thủ công):** import `obs/Zodiac-Live.json` (Scene Collection → Import) để có sẵn cảnh "Dem Hoi" với Browser Source 1080×1920, 30 FPS, bật âm thanh qua OBS. Rồi vào Settings → Video đặt *Base* và *Output* = **1080×1920** (phần này OBS không cho import theo cảnh).

**Chạy production:** `npm run live` giám sát server — nếu server sập sẽ tự khởi động lại sau 2 giây (điểm lưu 10 giây một lần nên gần như không mất gì; quá 5 lần trong 10 phút thì dừng hẳn để bạn xem log). Log ghi ở `logs/live-<ngày>.log`. Mỗi lần **Bắt đầu đêm mới** tự sao lưu `data/backup-night-N.json` (giữ 14 bản gần nhất).

### Kiểm chứng dữ liệu TikTok thật (buổi live đầu tiên)

Thư viện kết nối là bản không chính thức, nên cách duy nhất biết chắc TikTok gửi gì là nhìn vào dữ liệu thật. Đã chuẩn bị sẵn:
- **`npm run smoke`** (10 giây, không cần live): dựng server thử trên cổng riêng, bơm bình luận/tim/quà/follow theo đúng cấu trúc TikTok, kiểm tra overlay nhận đúng, ghi rồi phát lại. Chạy trước mỗi buổi phát.
- **`logs/tiktok-schema.json`** (tự tạo khi live): tên các trường TikTok thực sự gửi cho từng loại sự kiện (chỉ tên trường, không có nội dung người xem). Sau vài phút đầu, mở file này; nếu thấy trường lạ hoặc thiếu (vd không có `content` trong `chat`) thì báo lại để chỉnh `tiktok.mjs`.
- **`"recordEvents": true`** trong `config.json` (hoặc `PK_RECORD=1`): ghi mọi sự kiện game nhận được vào `logs/events-<ngày>.jsonl` (có tên và bình luận người xem nên chỉ lưu trên máy bạn). Sau buổi phát, `npm run replay -- logs/events-<ngày>.jsonl` (thêm `--speed 1` để chạy đúng tốc độ thật) phát lại cả đêm vào server đang chạy — để xem lại, chỉnh luật chơi, hoặc tái hiện một lỗi mà không cần live.
- Mọi sự kiện lỗi bị bỏ qua và ghi log, không làm sập chương trình.
- **Tên và avatar người xem được lọc trước khi lên sóng**: bỏ ký tự điều khiển/đảo chiều chữ, cắt tối đa 32 ký tự, thay link/số điện thoại bằng "Người xem", tên chứa từ trong `blockedWords` thành "Người xem ẩn danh"; avatar chỉ nhận ảnh https từ CDN của TikTok.

### Checklist trước giờ phát
1. `npm run check -- --online` không còn ✖.
2. Diễn tập bằng `npm run simulator` (thêm đám đông, quà, tim, follow/share, "xin quẻ", câu đố) xem overlay trong OBS/Studio không bị che chữ; thử `?audit=1`.
3. Nếu muốn bắt đầu từ đầu, bấm **Xoá toàn bộ** để bầu trời về 0. Diễn tập chạy ở server riêng nên không để lại gì trong dữ liệu LIVE.
4. Bắt đầu phát trên TikTok, rồi mới bấm **Kết nối** (hoặc đã đặt `tiktokUsername` thì tự kết nối). Chờ trạng thái `● live`.
5. Nhờ một tài khoản phụ thử: comment tên cung, thả tim, tặng quà nhỏ nhất → xem điểm có tăng và có thông báo.
6. Mỗi buổi mới: **Bắt đầu đêm mới** (giữ bầu trời, danh hiệu và huy hiệu).
- Nếu mất mạng giữa chừng: overlay hiện dải đỏ "Mất kết nối với máy chủ" sau 4 giây; kết nối TikTok tự thử lại (5s → 60s). Điểm lưu mỗi 10 giây ở `data/state.json`.

### Các thành phần
- Bảng điều khiển: `http://127.0.0.1:4848/control` — **tình trạng live** (đang nhận dữ liệu hay im, bình luận/tim/quà mỗi phút, tổng xu quà), kết nối TikTok, trạng thái đêm (trăng, sao may mắn, vòng), **bảng đua sao + tiến độ 12 chòm + số người mỗi cung**, người trên sân, nhật ký sự kiện có lọc theo loại, điều khiển (đêm mới, câu đố, bình chọn, quẻ chung, sao may mắn, nhạc), **công tắc bật/tắt từng sự kiện nhỏ trên màn hình** (được nhớ ở `data/settings.json`). Các nút diễn tập (kể cả **mưa người xem 300/giây**) chỉ hiện trong `npm run simulator`. Nhật ký chứa tên và bình luận thật nên chỉ gửi cho bảng điều khiển trên máy bạn, không bao giờ qua địa chỉ chia sẻ.
- `config.example.json` → `config.json`: chỉnh mọi con số (ánh sao, ngưỡng quà, mục tiêu trăng, sao may mắn, chuỗi đêm…), `tiktokUsername`, `blockedWords` (chặn chữ trên đèn ước).
- Linh vật `public/mascots/` dựng từ bộ nhân vật của pipeline video (`asset-library-v4/characters`, áo in ký hiệu cung). Dựng lại: `node build-mascots.mjs`.
- Font hiển thị Patrick Hand tự host ở `public/fonts/` (OFL) — overlay không cần mạng để tải font.
- Test: `npm test`.

## Mỗi lúc chỉ một sự kiện

Màn hình luôn chỉ hiện **một** thông báo (`public/lane.js`, có test ở `lane.test.mjs`). Bốn mức, mức cao ngắt mức thấp:

| Mức | Là gì | Ví dụ |
|---|---|---|
| 0 | dòng nhỏ giữa vòng tròn | có người vào, quà nhỏ |
| 1 | thẻ thông báo (dưới vòng tròn) | cung sáng, theo dõi/chia sẻ, quà pháo hoa, vượt lên |
| 2 | quẻ / câu đố / bình chọn | giữ đến khi game kết thúc phần đó |
| 3 | màn chúc mừng toàn khung | trọn vòng, trăng rằm, mưa sao băng, mốc người xem |

Thông báo bị ngắt sẽ bị bỏ (đã cũ), riêng quẻ/câu đố được hiện lại sau màn chúc mừng. Màn chúc mừng không nối đuôi nhau (nghỉ ~1,4 giây, tối đa 2 cái chờ) để thẻ và câu đố vẫn có lượt. Thêm `?audit=1` vào link overlay để kiểm tra tràn/chồng chéo.

## Lưu ý

- **Quẻ luôn miễn phí** (chỉ cần comment), mỗi người một quẻ mỗi ngày, có ghi "chỉ mang tính giải trí". Quà kích hoạt hiệu ứng và cộng ánh sao cho cung người tặng — không bán quẻ và không hứa quẻ tốt. Đừng hứa "tặng quà để được quẻ tốt" — vừa phản cảm, vừa trái [nguyên tắc kiếm tiền LIVE của TikTok](https://www.tiktok.com/live/creators/en-US/rules_and_guidance/live_monetization_guidelines) về dụ dỗ tặng quà.
- Đèn ước hiển thị chữ người xem: link và dãy số dài bị bỏ, từ trong `blockedWords` làm đèn chỉ hiện "điều ước bí mật". Có thể tắt hẳn chữ trong bảng điều khiển.
- Dùng thư viện **không chính thức** `tiktok-live-connector` (đọc luồng live công khai qua username). TikTok đổi giao thức thì có thể hỏng tạm thời; thư viện gửi yêu cầu ký qua dịch vụ Euler Stream bên thứ ba.
- Kết nối live cần khóa Euler Stream có quyền ký TikTok LIVE: điền `EULERSTREAM_API_KEY` trong `.env` (file này được Git bỏ qua). Quyền ký hiện là add-on trên gói Business; nếu thiếu, log sẽ báo `requires a Business plan` và app sẽ không nhận được sự kiện. Không ghi khóa vào `config.json`.
- Biến môi trường tuỳ chọn: `PK_NO_TIKTOK=1` chạy server mà không kết nối TikTok (phòng sẽ trống); `PK_FRAME_MS` đổi nhịp đẩy dữ liệu tới overlay (mặc định 250 ms).
- Cách phát hiện tại: **TikTok LIVE Studio** (nguồn Link qua `npm run share`), không dùng OBS. Phần OBS bên dưới chỉ để tham khảo, không tự động sửa hay mở OBS.
- Máy yếu: thêm `?lite=1` vào địa chỉ overlay (canvas 1x, 24 fps, bỏ đổ bóng/blur CSS); `&fps=NN` đổi số khung hình.
- Server chỉ nghe trên `127.0.0.1` vì API điều khiển không có mật khẩu.
- Server LIVE chính (cổng 4848) không có API diễn tập (`sim/*` trả 404) và bỏ qua mọi người xem `sim:` ngay từ cửa vào, nên diễn tập không thể chạm tới boss, kéo co, quà, trăng, mùa hay kho của LIVE thật. Diễn tập chỉ bằng `npm run simulator`.

## TikTok LIVE Simulator (diễn tập giao diện)

Mở một server diễn tập tách biệt, không đụng state/log của livestream thật:

```bash
cd tools/livestream-pk
npm run simulator
```

Trình duyệt mở `http://127.0.0.1:4850/simulator`. Simulator có khung LIVE 9:16, overlay thật của game trong iframe, giao diện chat TikTok giả lập, join, tim, quà/combo, follow, share, lượt xem và event feed. Có các kịch bản người mới vào, phòng sôi động, mưa quà, gameplay, spam chat, 100 người xem và stress test 300 người xem/giây.

Tương tác được gửi vào cùng logic `game.mjs` qua các API `sim/*`; overlay preview cập nhật qua luồng frame bình thường. Đây là mô phỏng phía client/server local, không phải giao diện TikTok chính thức và không giả lập giao thức mạng nội bộ của ứng dụng TikTok.

**Cách ly an toàn:** `npm run simulator` khởi chạy tiến trình server thứ hai trên cổng 4850 (có thể đổi bằng `PK_SIM_PORT`), đặt `PK_SIMULATOR=1`, `PK_NO_TIKTOK=1`, dùng `.simulator-data/` và `.simulator-logs/`. API kết nối TikTok thật bị khóa trong tiến trình này. Dữ liệu sản xuất vẫn ở `data/` và `logs/`. Dừng bằng Ctrl+C. Không đưa URL Simulator vào nguồn Link chia sẻ công khai.
