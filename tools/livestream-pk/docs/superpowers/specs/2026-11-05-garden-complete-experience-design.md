# Garden — khung trải nghiệm, trình chiếu và âm thanh

Trạng thái: **đề xuất để review, chưa phải thiết kế đã duyệt**. Yêu cầu ngày 2026-11-05; chất âm người dùng chọn: **hữu cơ vui nhẹ: nước, đất, lá, chuông mềm**. Đích phát: TikTok LIVE Studio; bỏ OBS.

## 1. Ý định và ràng buộc

Người mới chỉ cần bình luận “trồng”, thấy ngay chủ quyền chậu và biết bước tiếp. Người chơi cũ nhận ra LV, bậc chậu, thành tựu và tiến bộ. Quà/tim có tác động dễ hiểu, host biết chính xác màn phát đang làm gì. Khoảng trống, camera, nội dung và âm thanh cùng phục vụ hành động hiện tại.

- Giữ Node ESM, HTTP/SSE/poll, Canvas/SVG, Web Audio và các helper hiện có; không thêm thư viện hoặc engine game.
- Giữ 48 slot, save/progression và luật kinh tế hiện tại. Mọi mở rộng thị giác không tự thêm loại cây có chỉ số mới, giá quà, thưởng XP/vàng hoặc tăng sức chứa.
- Một cổng Garden **4858**, sim và thật chạy riêng thời điểm, data tách riêng. Không reset/restart/kết nối thật trong giai đoạn viết kế hoạch.
- Khung 1080×1920; đo đọc được ở 540×960 và 360×640. Không suy ra đủ cho 100–400 người từ 48 slot; bản mở rộng quy mô cần thiết kế tổng hợp riêng.
- Giữ token kênh đã có: giấy `#F6F0E6`, thẻ `#FFFDF9`, mực `#2F3C44`, chữ phụ `#5C6B75`, bóng `#D0C1B3`, teal `#8EC0B9`, coral `#E97A66`, ochre `#F2C45C`, slate `#435064`; Patrick Hand, nét doodle, bóng phẳng. Chỉ tái dùng phần token của tài liệu DESIGN cũ; không phục hồi bố cục bốn khu đã bị thay thế.
- Cây/chậu phải neo đúng kệ, khác bằng silhouette/chi tiết ngoài màu. Không gradient/neon/glow, ảnh stock hoặc thay phong cách.
- Native áp dụng kết quả đúng một lần. Camera, SFX, reload, tab ẩn và phát chậm không làm đổi kết quả.

## 2. Hướng tiếp cận

**Đề xuất: mở rộng hệ thống hiện có theo các hợp đồng nhỏ.** Reuse `createGarden`, `createCamera`, `createPresentationQueue`, coalescer, `createMusic` và `createSfx`; thêm catalog/cue/policy Garden riêng khi cần. Giảm rủi ro mất save và tránh viết lại simulator.

Phương án thay thế là thay renderer/director/audio bằng một nền tảng mới. Nó thuận lợi nếu game cần thay engine, nhưng không cần thiết để giải quyết các vấn đề hiện tại, làm tăng số đường cần nghiệm thu và rủi ro lệch dữ liệu. Chưa chọn phương án đó.

Lựa chọn kiến trúc này là đề xuất của người lập kế hoạch, chưa được người dùng duyệt; lựa chọn chất âm đã được người dùng xác nhận.

## 3. Phạm vi đầy đủ và cách nhận biết đã đủ

Các mã R01–R28 nằm trong [bảng audit yêu cầu](../plans/2026-11-05-garden-requirements-audit.md). Mỗi mã phải có task triển khai và bằng chứng nghiệm thu, kể cả tính năng đã có code. “Có code”, “unit pass”, “browser nhìn được”, “Studio thu được”, “LIVE thật nhận được” là các mức khác nhau.

### Vòng người chơi

- `trồng` chọn cây cao nhất đủ LV **và đủ vàng**: rau LV1, hướng dương LV2, nấm mây LV4; giữ fallback rau và lượt gieo lại miễn phí. Lệnh chọn thủ công vẫn dùng được. Không yêu cầu người mới nhớ tên cây.
- Phản hồi nêu đúng cây đã chọn, chủ chậu và bước `chăm`; sau chín là `hái`, sau hái là `trồng`. Kiểm tra người thiếu vàng, sai tên cây, đầy chỗ, trùng tên và quay lại sau ngủ/thu hồi chỗ.
- `vườn` không sinh modal hay zoom. Giữ hồi mỗi người 8s/cả phòng 8s, một yêu cầu mới nhất, hết hạn 15s; bị chặn phải có lý do. Khi đủ idle mới hiện thông tin gọn trong vùng sẵn có.
- Mọi cận cảnh hợp lệ đều hiện hồ sơ đúng chủ: avatar/fallback, LV, bậc chậu, XP, vàng, điểm/hạng, thành tựu nổi bật, trạng thái cây và hành động tiếp theo. Hồ sơ không che chính cây hay tên chậu khác.
- Top 5 và trao giải đều có avatar, tên dài không phá bố cục; ít hơn năm người thì chỉ có số người thật. Giữ thưởng Top 3 15/10/5 XP, snapshot identity sau rời phòng/reload, không trả hai lần.

### Camera, nội dung và ưu tiên

Mọi yêu cầu camera/thẻ phải khai báo lý do. `ripe`, `first harvest`, `joined`, `water`, `help`, `card/vườn` không được tự tạo cận cảnh; không thêm ngoại lệ “ít người” cho ripe/first harvest trong đợt này.

- Chờ **6.000ms liên tục** sau khi cảnh chính kết thúc và queue chính trống mới cho cận/hồ sơ/nội dung che vùng chơi. Quà mới, boss, awards hoặc mất dữ liệu màn phát làm hủy/đặt lại điều kiện rảnh. Đọc trạng thái màn phát thực tế, không chỉ cộng duration ước lượng từ server.
- Nếu có nhiều nguồn LIVE: tất cả nguồn LIVE đã đăng ký phải fresh và cùng đủ điều kiện rảnh; cảnh báo nguồn trùng có tiếng. Trong simulator chưa có LIVE source, dùng đúng một preview được chọn làm chủ diễn tập; production thiếu nguồn LIVE thì chặn nội dung phụ và báo chưa quan sát được. Nguồn stale chặn cho đến khi host loại nguồn đó hoặc entry hết hạn30s; không tự hiểu stale là queue trống.
- Chăm thường có phản hồi tại cây/header ngay, không đợi idle và không chiếm cảnh. Cận chỉ dành cho LV, trộm/bắt trộm, cây liên quan tới sự kiện; dedupe và TTL, không phát chuyện đã cũ.
- Boss giữ sân khấu suốt trận. Quà lúc boss là đòn đánh/ghi công trong arena; không có vòng quay/modal khác che boss. Awards là trạng thái riêng với CTA riêng; không hướng dẫn thao tác đang bị chặn.
- Tốc độ dự thảo: cận vào 500ms, giữ 1.600ms, ra 600ms; trộm/bắt trộm giữ 1.800ms; nghỉ toàn cảnh 6.000ms. Quà thường tối đa 1.800ms cảnh nhấn, vòng quay 3.600ms (quay 2.000ms, kết quả 1.600ms), impact 2.800ms. Phải đo đọc tên/kết quả trên điện thoại; được điều chỉnh sau nghiệm thu mà không đổi idle6s.
- Tối đa **12s chi phí cảnh dài đang chờ**, không tính cảnh hiện tại. Khi vượt ngân sách hoặc hiệu ứng đã hết, chuyển cảnh cũ sang ghi công/kết quả gọn theo ID, không bỏ kết quả native. Log cho host có lý do gộp/rút gọn/hết hạn.
- Khi reconnect, server trả recent presentation receipts tối đa 64 bản/120s; chỉ có scene đang hiệu lực mới phục hồi tiến độ, còn lại hiện kết quả gọn. Khôi phục không chạy lại spin/applyGift/strike hoặc phát lại âm mở đầu.
- ClientId giữ trong sessionStorage theo tab. Checkpoint presentation cùng sceneId, eventIds đã kể, phase và thời điểm bắt đầu theo epoch được lưu khi đổi phase; reload cùng tab phục hồi thời gian đã trôi rồi đối chiếu receipt. Subscriber mới không có checkpoint chỉ hiện kết quả quà gần nhất còn hiệu lực dưới dạng gọn, không dựng lại vòng quay từ đầu. Checkpoint lỗi/quá cũ dùng kết quả gọn; không xả queue cũ từ phiên trước.
- Thời tiết không phụ thuộc camera: nếu pha hợp lệ và không có boss/awards thì active ngay; camera kể lại trạng thái. Đến boss/reset phiên kết thúc thời tiết theo luật đã có. Không tồn tại pending vô hạn do queue/lock.

### Đồng hồ khi boss

Tạm dừng đồng hồ phiên và thời gian chăm cây: tiến độ/nước, quá lứa, buff/debuff, shield/blessing/dog, chậu hỏng, ngủ/nhường chỗ và các cooldown chăm/trộm liên quan. Đồng hồ boss và chống spam đầu vào vẫn chạy thật. Hạn quà được tạo giữa trận chỉ bù phần từ lúc nhận quà; không dịch đủ cả trận cho quà đến muộn.

Persist mốc pause/resume đủ để thắng, hết giờ, lưu/tải hoặc restart giữa boss đều bù đúng một lần. Không thay đổi kết quả/kinh tế quà trong boss. Test cây chín 100s + boss45s vẫn nhận đủ sản lượng thay vì bị phạt quá lứa.

## 4. Không gian và nhận diện

- Giữ slot ID và vị trí trong cùng phiên. Không tự phóng/đổi bố cục khi người vào/rời làm chậu nhảy chỗ.
- Header phải chuyển theo bối cảnh: mới vào → trồng; cây đang lớn → chăm; boss → tim/quà đánh boss; awards → Top 5/đếm ngược. Khi focus có thể tái dùng ô xếp hạng cho hồ sơ; không thêm thẻ mới vào vườn.
- Vùng kệ trống dùng tối đa một nội dung theo ngữ cảnh: mốc cá nhân, “vừa giúp ai”, tiến độ nhóm, cây/chậu sắp mở. Chỉ hiện sau idle6s, không lặp cùng nội dung trong 30s, nhường ngay khi có người/cảnh chính. Vùng trống không có việc hữu ích thì để thoáng.
- Dựng contact sheet kiểm 5 bậc chậu × 3 giai đoạn nhìn × 3 loại cây × 3 biến thể cây và cận cảnh. Phân biệt “bậc chậu” với biến thể cây, không nhân danh mục giả.
- Bổ sung trong phạm vi mỹ thuật: **5 họa tiết chậu kiếm được bằng mốc**, áp lên cả 5 silhouette hiện có; **mỗi loại cây thêm một chi tiết trưởng thành riêng** (lá/cụm/nụ), không đổi chỉ số. Chọn họa tiết từ thành tựu, không từ quà trả tiền; một họa tiết chính/chậu.
- Giữ danh hiệu cũ; thêm mốc tích lũy **hái100, giúp50, dọn sâu50** dùng counter đã có, không tạo daily streak/timezone mới. Thêm nhãn mở bậc chậu LV3/5/7/9; không phát thưởng kinh tế mới. Tên đề xuất: “Mùa vụ trăm hoa”, “Bàn tay xanh”, “Người gác vườn”.
- Khi một hành động tạo nhiều mốc: một thẻ gộp avatar + LV/bậc/thành tựu; thứ tự ưu tiên bậc mới → danh hiệu mới → LV thường. Không ba âm thanh và ba thẻ liên tiếp. Kiểm tra retroactive mốc từ save cũ không gây spam cả kho danh hiệu lúc startup.

## 5. Motion gắn với kết quả

Mọi motion có ba pha **chuẩn bị → tác động → kết quả**, dùng snapshot trước/sau do event cung cấp. Nếu snapshot thiếu/plot biến mất thì hiện kết quả gọn, không crash/đánh nhầm cây. Native luôn xử lý trước; hình cây vừa hái là ghost hình ảnh có TTL, không phục hồi crop thật.

| Nhóm | Điều cần thấy | Âm khớp pha |
|---|---|---|
| Trồng | Hạt chạm đất, mầm xuất hiện, tên chủ | đất ở điểm chạm, chuông mầm ngắn |
| Tưới/help | Nước tới đúng cây, đất ướt, tiến độ/XP; help có người giúp/nhận | nước tại pha tưới, một cue help khi hoàn tất |
| Hái | Cây vừa hái → nông sản/vàng/XP → chậu trống + trồng | lá/tách nhẹ ở hái, chuông kết quả |
| Phân/sâu/cỏ | Vật liệu vào đất / sâu/cỏ ra khỏi cây / trạng thái sạch | rắc đất / lá mềm / nhổ nhẹ |
| Trộm/bắt/khiên | Đường tác động và đúng chủ bị ảnh hưởng; chặn có kết quả khác | bước lá/tách/khiên gỗ mềm |
| Quà 1/5/100 | Sương / phân sao / mưa có hình và vùng tác động khác | nước / chuông mềm / mưa ngắn |
| 50 | Quay, chốt đúng ô, nối mục tiêu, hạn còn lại và cách gỡ | mở, tick đồng bộ, chốt; không loop âm máy quay dài |
| 500/1.000 | Báo mục tiêu, bay/địa chấn, khiên chặn hoặc phá, gieo lại | fly / impact / chặn; không dùng cùng một âm cho mọi kết quả |
| Boss | Intro, tim/quà thành đòn, HP phản ứng, thắng/trốn | intro, hit gộp, giftHit, kết quả |
| LV/mốc/Top5 | Bậc chậu/mốc đổi rõ; người thắng giữ identity | một cue ghi nhận phù hợp, podium/reward ngắn |

Tối đa 8 plot chi tiết mỗi coalesced batch250ms theo cap hiện có; số còn lại có phản hồi tổng/count rõ. Giảm hạt trước khi giảm độ rõ kết quả. Reduced-motion giữ snapshot kết quả, tắt rung/camera travel/particle thừa; không dùng âm thanh làm đường phản hồi duy nhất.

## 6. Kho SFX hữu cơ và nhạc

### Hiện trạng đã kiểm tra

35 MP3 (~3,43 MB), 31 role trong `public/sfx/manifest.json`, không thiếu file được tham chiếu. `listMusic` hiện thấy calm2/upbeat18/skipped1; catalog `audio-pack.json` khai báo 16 bài, không có nghĩa tất cả phù hợp Garden. Các cue chăm đang dùng `sparkle/cleared/cardFlip/boon`; tưới/help không có cue riêng trong `handleFx`. Kho tồn tại nhưng **chưa nghe và nghiệm thu mức âm**.

`createSfx` hiện yêu cầu role tồn tại trong bảng synth mới phát được sample; chỉ thêm role vào manifest chưa đủ. Limiter8 âm/s đếm lượt bắt đầu, không đếm âm đang kéo dài hoặc ưu tiên boss/quà. Loader decode cùng file nhiều lần khi file xuất hiện ở nhiều role. Nhạc chỉ calm/upbeat, chưa là nhạc boss có vòng đời riêng. Đây là phần audit trước bỏ sót.

### Gói bàn giao

Catalog Garden riêng, dùng file local, **36 role** dưới đây; mục tiêu **50 sample đã duyệt**: 2 biến thể cho 7 role chăm thành công + 6 role ghi nhận/xã hội + wheelResult; các role còn lại 1 file. Biến thể chọn tránh lặp liên tiếp khi có lựa chọn. Không đạt chất lượng thì báo thiếu, không nhồi file chung vào cho đủ số.

- Care8: `plant`, `water`, `help`, `harvest`, `fertilize`, `pestClear`, `weedClear`, `softBlocked`.
- Social6: `levelUp`, `tierUnlock`, `achievement`, `theft`, `catch`, `shieldBlock`.
- Gift9: `dew`, `star`, `rain`, `wheelStart`, `wheelTick`, `wheelResult`, `meteorFly`, `meteorImpact`, `quake`.
- Boss5: `bossIntro`, `bossHit`, `bossGiftHit`, `bossWin`, `bossEscape`.
- Session4: `roundStart`, `podium`, `reward`, `roundEnd`.
- Weather4: `rainStart`, `pestsStart`, `merchantStart`, `goldenStart`.

Giai đoạn âm mở/tác động có thể cùng role chứa các marker/cut phù hợp; không phát nhiều sample cùng lúc chỉ để đủ ba pha. `softBlocked` mặc định chỉ nghe trong trang thử âm/control, không làm spam lỗi trên nguồn LIVE; đã có chữ lý do.

**Catalog mỗi role:** files, gain, cooldownMs, priority, maxDurationMs, fallback. **Mỗi asset:** id, file, durationMs, sourceUrl hoặc selfRecorded, author, licenseId/licenseUrl, retrievedAt, sha256, trimStartMs/trimEndMs, gainDb, tags, reviewStatus. Không chứa đường dẫn máy cá nhân trong manifest public. Chỉ đưa asset đã review vào runtime; không tự tải ở buổi LIVE.

Chất âm: nước/đất/lá tự nhiên, chuông mềm; quà lớn/boss dùng trống gỗ/âm trầm ngắn, tránh chói/giật mình. Không lấy tiếng nói, nhạc có lời, meme/shout để làm cue mặc định. Source/license hiện có là ghi chép lịch sử, phải xác minh nguồn mới trước khi nhập; chưa kết luận quyền của asset chưa chọn. Có thể dùng tự ghi hoặc nguồn cho phép; không phát tán nguyên pack thô nếu license không cho.

### Runtime và mixer

- Tái dùng `createSfx(volume, options?)` với tùy chọn manifest Garden, load/decode cache theo URL, sample role độc lập với synth role và fallback khi thiếu. Giữ lời gọi cũ của PK chạy như cũ.
- Một controller Garden điều phối cue; không tạo queue gameplay khác. Nhận cue với eventId/sceneId, phase, target, count, age; chặn phát lại theo ID/phase. Care phát khi thấy tác động; wheel/impact/boss cue theo phase trên màn đang phát, không theo lúc xếp queue.
- 4 nhóm gain: master, music, care, event; mặc định master1/music0,16/care0,20/event0,25. Tham số `music`/`sfx` cũ vẫn mute/đặt mức như trước; SFX0 phải tắt toàn bộ care/event và không decode không cần thiết. Chưa coi gain này là mức âm đã nghe chuẩn.
- Tối đa **6 sample voices đồng thời**, care tối đa3, event tối đa3; không quá8 cue starts/s. Giữ chỗ hoặc ngắt care cũ cho boss/quà quan trọng. Tick vòng quay thuộc scene, không chen mất quyền âm kết quả.
- Cooldown dự thảo: care250ms/role, ghi nhận1.500ms (achievement4.000ms), bossHit180ms và gộp sát thương; cue lỗi không trên nguồn live. Không phát âm cho mỗi tim/comment. Lượt bị gộp có count trong control.
- Care bị trễ >500ms thì bỏ âm cũ, vẫn giữ hình/count; không có backlog âm hàng chục giây. Cue scene kết quả không bỏ vì limiter care; có quyền ưu tiên. Mute/stop/đổi phiên dọn voices, tick timers và duck token.
- Duck là lease theo cue/scene: lấy mức giảm mạnh nhất còn hiệu lực, tự phục hồi khi kết thúc/hủy, không bị cue nhẹ ghi đè. Nhạc nền giảm còn35% trong quà/mốc,20% trong intro/kết quả boss; không duck nền cho mỗi lượt tưới.
- Các lease nằm trong controller Garden; shared `music.duck(amount,ms)` vẫn tương thích PK. Controller tính mức nhỏ nhất và hạn còn lại, trả `duck(1,0)` khi hết lease; thêm `music.setVolume(n)` và `music.status()` để mixer/diagnostics quan sát mức nền hiện tại.
- Nhạc: giữ calm/upbeat đã có; chọn playlist Garden từ bài thực có/đã nghe, boss dùng mood upbeat và intro/outro riêng, không bắt buộc thêm bài. Ambient chim/gió **không bật mặc định**, tránh thêm lớp ồn và vấn đề loop. Nhạc không lời, host mic là ưu tiên; hiệu quả cuối phải nghe bản thu Studio.
- Warmup trước diễn tập báo ready/loading/blocked/missing/fallback. Chặn autoplay không làm đơ overlay, không dồn phát âm cũ khi được unlock; quà native vẫn chạy. Có nút thử/mute/stop trên control, không thêm nút debug trên màn LIVE.
- Mỗi cảnh đang nghe có role/sampleId/fallback/voices/dropped/coalesced/autoplay/context trong diagnostics. Không tuyên bố mic duck tự động; Studio vẫn phải cấu hình mic/nguồn thu.

## 7. Simulator, control và màn phát thực

- Tách rõ simulator actions, vận hành phiên, preview, monitor màn LIVE và kho âm. Desktop đặt preview/monitor gần nút thử; màn hẹp có tab Thử/Xem/Log/Âm thanh. Một lần bấm có trạng thái gửi/thành công/chặn, kết quả native và cảnh theo ID.
- Có gift presets **1/5/50/100/500/1.000**, giá trị tự nhập và tổng diamonds×count. Có đối thủ, khiên, crop sắp chín/quá lứa, boss, quà giữa boss, burst, chat `vườn` spam, awards và reload/reconnect. Fixture/reset chỉ simulator, không thay data thật; snapshot fixture phục hồi được.
- Kịch bản một nút: người mới1; nhóm4; room12/24/48; chăm hàng loạt; spamvườn; giftburst30; bossinterrupt; shield/no-target/destruction; award/reload; audioquiet/busy. Không chỉ bấm nút quà riêng lẻ để gọi là phủ đủ cơ chế.
- Overlay khai báo `display=live|preview` và clientId ngẫu nhiên theo tab; preview ép mute. Overlay được Studio thu gửi heartbeat local mỗi1s (bounded payload), mất dữ liệu >3s thì stale; xóa sau30s. Tối đa8 client entries, không lưu telemetry này vào save.
- Giữ kênh postMessage cho iframe; thêm báo cáo nguồn phát qua server localhost để control phân biệt “Preview” và “Nguồn LIVE”. Nếu chưa thấy nguồn LIVE thì ghi chưa kết nối; không lấy queue iframe làm queue LIVE.
- Monitor: native boss/event/session, camera queue, **actual display** scene/phase/targets, primary/secondary counts/oldestAge, idle eligibility + reason, FPS/visibility/stale, audio readiness/voices/fallback và build/revision. Tên/ID gọn, không lộ key hoặc log riêng tư.
- Nhiều nguồn `display=live` đang có tiếng thì cảnh báo host, không tự phát thêm nguồn thử âm. SFX thử mặc định route control riêng, yêu cầu chọn rõ khi muốn nghe từ nguồn LIVE để tránh hai tiếng; không tự sửa mixer Studio.
- Trước LIVE có readiness checklist đọc được: code revision đã nạp, sim/live, data path loại nào, assets/audio lỗi, đúng overlay 4858, số nguồn live/audible, queue/phase, kết quả diễn tập. Không tự connect để kiểm tra key; key chỉ báo có cấu hình.

## 8. Nghiệm thu và bàn giao

1. Regression fake-clock: weather không kẹt; boss pause đủ; awards/gift/restart không trả hai lần; spam và thiếu chỗ/vàng có phản hồi.
2. Browser thực: toàn bộ R01–R28 ở 1/4/12/24/48 người, tên dài, avatar hỏng, reduced-motion, hidden/reload; ảnh/chuỗi motion, ID sự kiện và native result đối chiếu được.
3. Âm thanh tự động: catalog files/decode/checksum, fallback, limiter/priority, duck chồng, mute0, autoplay denied, no replay, PK callers. Âm thanh nghe thật: 50 sample và bản mix lúc yên/đông/quà/boss/awards trên máy phát; file hiện diện không bằng nghe đạt.
4. LIVE Studio: source 9:16, một đường âm, control ngoài vùng thu, vùng che đo trên điện thoại, 15–20 phút encode/capture. Không chạy OBS.
5. LIVE thật sau đó: tài khoản phụ comment/tim/quà, disconnect/reconnect có kiểm soát; hạn chế connect lặp tiêu quota. Báo riêng phần chưa thử.

Hiệu năng đề xuất: phản hồi thành công cơ bản p95≤500ms trong diễn tập local; cảnh không chặn farming khi chưa có boss/awards. Kiểm tra preview nguồn LIVE đạt trung vị≥30FPS và p95 frame interval≤50ms trong lượt encode 15 phút; log trạng thái tab/máy/canvas, không lấy hidden-tab/headless làm số nghiệm thu. Nếu máy không đạt, giảm particle/detail trước, không giấu độ trễ hoặc giảm đúng đắn gameplay.

Đầu ra: catalog và giấy nguồn, thư viện nghe/thử, rule cue/camera, bộ nhận diện contact sheet, kịch bản simulator, monitor nguồn LIVE, bằng chứng theo R-ID, checklist Studio. Không release/package trong yêu cầu lập kế hoạch này.
