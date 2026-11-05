# Garden Complete Experience Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement task-by-task after design review. Steps use checkboxes. Không tự dispatch implementer hoặc commit toàn dirty tree; yêu cầu hiện tại là lập kế hoạch.

**Status:** Draft để duyệt; chưa triển khai. Chất âm hữu cơ đã được người dùng chọn; các số lượng mỹ thuật/mốc và thời lượng dưới đây là đề xuất thiết kế.

**Goal:** Hoàn thiện toàn bộ R01–R28, từ lệnh một bước đến trình chiếu, nhận diện, motion/SFX, simulator/control và nguồn phát TikTok LIVE Studio.

**Architecture:** Giữ native Garden là nguồn kết quả duy nhất. Camera/presentation chỉ kể kết quả; renderer và audio cùng dùng eventId/sceneId/phase. Mở rộng shared audio API tương thích PK, tách catalog/policy Garden; monitor preview và nguồn LIVE độc lập.

**Tech Stack:** Node ESM, native HTTP/SSE/poll, Canvas/SVG, Web Audio/HTMLAudio, CSS và Playwright sẵn có. Không dependency mới.

**Spec:** [Thiết kế đầy đủ](../specs/2026-11-05-garden-complete-experience-design.md).

**Coverage:** [28 yêu cầu và audit bổ sung A11–A17](2026-11-05-garden-requirements-audit.md). [Tái hiện lỗi A1–A10](2026-11-05-garden-prelive-audit.md).

## Global Constraints

- Bảo toàn save, user progression, 48 slot, Top5 và thưởng Top3 15/10/5 XP. Không đổi kinh tế quà/cây.
- Một port4858; sim/live không chạy song song, data tách biệt. Mọi fixture/test dùng temp dir + `tiktok:false`.
- Idle liên tục6.000ms trước nội dung che/cận/phụ. Không zoom ripe/firstHarvest/join/card/water/help.
- Boss giữ arena; gameplay chỉ áp dụng đúng một lần. Reload, audio hoặc camera lỗi không chạy lại quà.
- Token/font theo spec; hình doodle/SVG hiện có, không engine/library mới, không kéo ảnh/audio từ internet lúc LIVE.
- SFX hữu cơ nước/đất/lá/chuông mềm; 36 role, mục tiêu50 sample đã nghe duyệt. Asset chưa chọn chưa được coi là đã có quyền sử dụng.
- TikTok LIVE Studio là đích nghiệm thu. Không chạy OBS, không tự go-live, không tự connect để đo key và không build/package/release.
- `npm run live/check` của PK không thay kiểm tra Garden; shared sfx/music thay đổi phải kiểm caller PK.

## Review Focus

1. Reload/reconnect giữa cảnh quà hoặc giữa boss: khôi phục hình/kết quả, không nhân thưởng hoặc phát âm mở đầu lần hai — T01/T02/T08/T09.
2. Quà đến muộn trong boss: chỉ bảo toàn phần thời gian từ lúc nhận, không bù cả trận; save/restart không bù hai lần — T01.
3. Nhiều người/tên trùng/avatar lỗi/48 lượt chăm: đúng chủ/target, đủ phản hồi tổng, không mất ghi công vì cap hiệu ứng — T03/T04/T06/T10.
4. Audio blocked/thiếu/hỏng/đổi mute/burst: hình vẫn chạy, fallback rõ, không nổ âm cũ khi unlock, cue quan trọng không bị care đẩy mất — T07/T08.
5. Iframe và cửa sổ Studio có queue khác nhau, source ẩn/stale hoặc hai nguồn có tiếng: monitor không báo rảnh/ready giả — T02/T09/T11.

## File map và thứ tự

| Phần | Tái dùng/chỉnh | File mới dự kiến | Trách nhiệm |
|---|---|---|---|
| Native | `garden/{garden,events,boss,care,competition,camera,fx,server,store}.mjs` khi task cần | Không thêm native engine | Kết quả, clock, receipts, event payload |
| Trình chiếu | `public/garden/{presentation,garden,view}.js` | Không thêm scheduler thứ ba | Cảnh/phase/idle/ghost result |
| Mỹ thuật | `identity.js`, `identity.css`, `garden.css`, `index.html`, SVG crop hiện có | Contact sheet trong bằng chứng; SVG pattern chỉ nếu không dựng được bằng helper | Silhouette, mốc, overlay content |
| Catalog âm | `public/sfx.js` tương thích callers cũ | `garden/audio-catalog.json`, `scripts/prepare-garden-audio.mjs`, `public/garden/audio/{manifest.json,LICENSES.md,*.mp3}` | Provenance, chuẩn hóa/import local, sample cache/fallback |
| Cue policy | `public/music.js` chỉ phần cần cho state/duck; `garden.js` nối cue | `public/garden/audio.js` | Chính sách theo phase, priority, voices, duck/mute/status |
| Control | `control.html`, `control.css`, `control.js`, `garden/server.mjs` | `public/garden/audio-library.js` nếu cần tách thao tác nghe catalog | Monitor nguồn LIVE, thư viện âm, kịch bản thử |
| Verify/ops | Tests `.test.mjs` hiện có, `garden/README.md`, `ops/live-studio-garden/*` | `garden/audio.test.mjs`, `garden/audio-catalog.test.mjs`, `garden/display.test.mjs`, `scripts/garden-rehearsal.mjs` | Regression, acceptance, runbook |

Thứ tự: **T00 → T01 → T02 → T03/T04 → T05 → T06 → T07 → T08 → T09 → T10 → T11 → T12**. T07 chọn/chuẩn bị asset có thể làm độc lập sau T00 nhưng audio integration chờ phase T02/T06. Chia theo đầu ra test được, không làm đồng thời các task cùng sửa garden.js/server.mjs trong một checkout.

### T00 — Khóa phạm vi và bản nền có thể đối chiếu

**Files:** đọc design/coverage/audit; kiểm `git status`, `package.json`, `garden/README.md`; bằng chứng tại `logs/garden-complete-baseline-<timestamp>/`.

**Interfaces:** nhận HEAD/dirty diff/runtime hiện có; tạo baseline metadata và checklist R01–R28, không thay save.

- [ ] Review design, đặc biệt đề xuất 5 họa tiết/mốc mới, ngân sách scene12s và36role/50sample. Ghi các quyết định được duyệt vào spec trước sửa runtime.
- [ ] Ghi branch/HEAD, modified/untracked paths, PID/loaded revision, data mode và ảnh hiện trạng. Không ghi nội dung key; không dùng Git reset/stash để làm sạch.
- [ ] Lưu evidence trước thay đổi: 1/12/48 cây, zoom, vườn spam, vòng quay, impact, boss và awards bằng fixture temp. Khẳng định đúng target/crop trước khi chụp.
- [ ] Chạy baseline `node --test --test-concurrency=1`, lưu nguyên kết quả; chạy các repro audit riêng. Pass tổng không đánh dấu các repro là fixed.
- [ ] Gate: mọi R-ID có task; mọi sửa dự kiến đều có save/caller/test nằm trong phạm vi đã đọc.

### T01 — Sửa thời gian boss và vòng đời thời tiết

**Files:** sửa `garden/garden.mjs`, `events.mjs`, `care.mjs`, `boss.mjs`, `competition.mjs`, `store.mjs` chỉ khi thêm persisted field; tests `boss.test.mjs`, `events.test.mjs`, `care.test.mjs`, `garden.test.mjs`, `store.test.mjs`.

**Interfaces:** `createGarden().boss` giữ API force/like/tick/status. Native pause có mốc persisted; `events.tick()` bảo đảm start/end độc lập với camera. Schema mới phải đọc save cũ không mất progression.

- [ ] Test trước: chín100s + boss45s → hái đủ10; buff30s trước boss còn30s sau boss; quà cấp buff ở giây40 của boss60 chỉ bù20s; restart ở giây30 không trả thưởng/bù giờ hai lần; boss escape tương tự thắng.
- [ ] Kiểm tất cả deadline plot/user/crop/limiter: phân loại “thời gian chăm” và “chống spam thật”. Dịch phần chăm/giữ chỗ đúng một lần; chống spam không đóng băng. Test cả negative dt và no-session/no-crop.
- [ ] Tái hiện camera lock/drop + rain: sau tick phase hợp lệ thì active hoặc kết thúc có reason, không pending vô hạn. Không có client overlay vẫn chạy. Boss/awards chặn đúng luật; không hủy và trả thưởng event hai lần.
- [ ] Chạy `node --test garden/boss.test.mjs garden/events.test.mjs garden/care.test.mjs garden/garden.test.mjs garden/store.test.mjs` trước/sau; lưu kết quả FAIL→PASS của case mới.
- [ ] Gate: save cũ đọc được, clocks/stage/yield đúng, weather không phụ thuộc shot để bắt đầu.

### T02 — Một quy tắc scene/idle, quà quá trễ và phục hồi

**Files:** `garden/camera.mjs`, `garden/server.mjs`, `public/garden/presentation.js`, `public/garden/garden.js`, `view.js`; tests `camera.test.mjs`, `presentation.test.mjs`, `server.test.mjs`.

**Interfaces:** giữ queue API `push/tick/clear/snapshot`, mở snapshot với `sceneId`, `phase`, `primaryBudgetMs`, `idleSince`, `blockedReason`, `targetIds`. Receipts `{eventId,sessionNo,receivedAt,kind,result,expiresAt}` có cap64/120s; server chỉ gửi kết quả đã có. `camera.tick` nhận/đọc display readiness qua state duy nhất, không có connected LIVE source thì trạng thái phụ là chưa xác nhận, không giả rảnh.

- [ ] Test `ripe/firstHarvest/join/water/help/card` không sinh close-up, cả1/48 người. Test LV/theft/catch/event-focus có reason và TTL.
- [ ] Test queue empty ở t0: t5.999s không phát phụ, t6.000s mới có; quà đến t5s reset; boss/awards/stale chặn. Preview đang idle nhưng live đang roulette phải chặn theo live. T09 nối heartbeat sau, test T02 dùng injectable display state.
- [ ] Nhiều nguồn LIVE lấy điều kiện bảo thủ: tất cả nguồn đã đăng ký còn trong TTL phải fresh và rảnh. Simulator chưa có LIVE dùng một preview làm chủ diễn tập; production thiếu LIVE thì báo unknown và chặn phụ. Test stale chặn đến khi host loại entry hoặc hết TTL30s.
- [ ] Thay thời lượng theo spec; cap cost scenes chờ12s. 30roulette vẫn giữ30 receipt/ghi công nhưng cảnh dài có giới hạn và kết quả gọn rõ; effect expired không quay như mới.
- [ ] Boss preempts cảnh che, quà vào arena; scene cũ đã áp dụng chỉ thu gọn. Awards/pause/end không làm mất ghi công hoặc giả apply lại.
- [ ] SSE/poll initial/reconnect gửi receipts, resume phase theo thời gian, không gọi lại native gift. Dùng eventId hiện có/sequence cho các event cần phase; cap/dedupe bounded, session reset không tái dùng ID.
- [ ] Lưu checkpoint trong sessionStorage theo clientId của tab: sceneId/eventIds/phase/startedAtEpoch/sessionNo. Reload trừ thời gian đã trôi và đối chiếu receipts; tab mới/checkpoint hỏng chỉ nhận kết quả gọn còn hiệu lực, không quay lại từ đầu. Test epoch/server offset và checkpoint phiên cũ.
- [ ] Chạy `node --test garden/camera.test.mjs garden/presentation.test.mjs garden/server.test.mjs`; browser reload roulette/impact và burst→boss; đối chiếu kết quả native trước/sau.
- [ ] Gate: nguyên nhân cảnh/zoom nhìn được, idle đúng, boss luôn thấy, reload không mất kết quả hoặc nhân tác dụng.

### T03 — Luồng một lệnh, CTA và thông tin “vườn”

**Files:** `garden/commands.mjs`, `care.mjs`, `copy.mjs`, `garden.mjs`, `public/garden/garden.js`; tests `commands.test.mjs`, `care.test.mjs`, `copy.test.mjs`, `interaction.test.mjs` (dùng file hiện có, tạo mới chỉ nếu chưa có).

**Interfaces:** giữ `parseCommand` và response `{ok,reason,message,crop,retryAfterMs,...}`; CTA chọn từ native phase/crop, không từ guide timer chung. Card request giữ latest/TTL/throttle đã có.

- [ ] Test `trồng/trong/gieo`, LV1/2/4, đủ/thiếu vàng, explicit crop/unknown, replantCredit, full room, ngủ/thu hồi chỗ; cây tự chọn phải đúng cả LV lẫn seedCost.
- [ ] Test 100 `vườn`/nhiều user: cooldown8s, global8s, latest-only, TTL15s, không modal/shot, không đè boss/quà/hồ sơ focus.
- [ ] Sửa lời phản hồi và guide CTA: đầu tiên trồng → chăm → hái → trồng; boss tim; awards đếm ngược. Chăm tự động không tự tiêu vàng; thiếu tiền không khuyên mua cây khóa LV.
- [ ] Browser solo hoàn chỉnh bằng clock fixture; không quà/khán giả giả để mở vòng. Đối chiếu đúng chủ khi tên trùng/mention mơ hồ.
- [ ] Chạy tests các file trên; gate: người mới đi được hết vòng và luôn có một hành động có ích, hợp lệ.

### T04 — Ghi nhận cá nhân, mốc mới, Top5 và avatar

**Files:** `garden/competition.mjs`, `progress.mjs`, `garden.mjs`, `public/garden/identity.js`, `identity.css`, `garden.js`; tests `round.test.mjs`, `experience.test.mjs`, `view.test.mjs`, `garden.test.mjs`.

**Interfaces:** thêm title IDs `harvest100`, `helpful50`, `pestKeeper50` dùng career hiện có; profile trả đủ avatar/level/potTier/xp/gold/rank/milestone/titles. Một notification có danh sách mốc của cùng action, không nhiều card/sound độc lập.

- [ ] Test crossing99→100/49→50, không award lặp; save cũ counters cao nhận mốc theo một thông báo gọn khi đủ điều kiện, không startup flood. Không thêm XP/vàng cho mốc.
- [ ] Test một action cùng tăngLV/mởbậc/đạt danh hiệu → một notification với đủ thông tin, priority đúng. Avatar remote hỏng/URL không hợp lệ dùng fallback, tên tiếng Việt dài và empty name an toàn.
- [ ] Test Top5 có0/1/5/48 người, tie theo luật hiện tại, rời phòng/reload; awards chỉ số người thật, Top3 XP15/10/5 trả đúng một lần. Giữ snapshot avatar.
- [ ] Tất cả cận hợp lệ có hồ sơ đúng người và action; cây lớn không chồng card. T05 chỉnh vị trí/header, T08 gộp cue theo notification này.
- [ ] Chạy `node --test garden/round.test.mjs garden/experience.test.mjs garden/view.test.mjs garden/garden.test.mjs`; gate: identity xuyên suốt profile/notice/ranking/awards, mốc không spam.

### T05 — Token, đa dạng cây/chậu và khoảng trống

**Files:** `public/garden/identity.js`, `garden.js`, `garden.css`, `index.html`, crop SVG trong `assets/`; `garden/progress.mjs` chỉ map unlock trang trí; test `view.test.mjs`, `experience.test.mjs`.

**Interfaces:** `POT_ART` giữ5 tier IDs; thêm cosmetic pattern theo title có thứ tự xác định, không field kinh tế. Profile header và idle-content dùng phase/readiness T02, milestone T04. Geometry slot/crop anchor giữ nguyên.

- [ ] Lập contact sheet trước/sau đủ5tier/3crop/3variant/stage. Audit palette/font/stroke/anchor, đánh dấu thứ khó phân biệt ở360×640; không chỉ so SVG phóng lớn.
- [ ] Bổ sung5 pattern: dấu hạt (firstHarvest), vệt nước (helpful), gân lá (pestKeeper), vòng mùa (harvest50), khắc vườn (harvest100). Có thể gắn lên mọi silhouette; chọn ưu tiên mốc cao nhất, một pattern chính/chậu. Thêm lá/cụm/nụ trưởng thành riêng từng loại cây, giữ data/crop ID/yield.
- [ ] Thử header tái dùng vùng ranking lúc focus; idle-content dùng một vùng kệ rỗng, không lặp30s và nhường ngay. Không dời slot khi join/leave; boss/awards/scene bận không có nội dung phụ.
- [ ] Browser matrices1/4/12/24/48, long name, stage ripe/old, shield/problem, focus, boss, awards. Lưu bounding boxes/ảnh để kiểm collision và vùng trống có ích.
- [ ] Test fallback pattern/tier/variant save cũ; chạy view/experience tests. Gate: phân biệt được silhouette/biến thể ở kích thước phát, không có cosmetic che nội dung cần đọc.

### T06 — Animation đầy đủ theo tác vụ và quà

**Files:** `garden/fx.mjs`, `care.mjs`, `gifts.mjs`, `destruction.mjs` nếu payload thiếu; `public/garden/garden.js`, `view.js`, `garden.css`; tests `fx.test.mjs`, `interaction.test.mjs`, `gifts.test.mjs`, `presentation.test.mjs`.

**Interfaces:** event cho phép `{eventId,plotId,before,after,result}` tối thiểu theo tác vụ, danh sách targets/capped sample + total. Visual ghost giữ trước khi crop mất, TTL ngắn; phase `intro|action|result|done` và `sceneId` của T02 là hook cue cho T08.

- [ ] Test event payload trước/sau có đúng crop/variant/target/yield; coalescer48action vẫn giữ count48 và sample8, không tạo thưởng lần hai.
- [ ] Motion care: hạt→mầm, nước→đất→result, hái→vàng/XP→chậu, phân, sâu/cỏ, help, trộm/bắt/khiên. Không cần cận cho thao tác cơ bản; snapshot thiếu dùng kết quả gọn.
- [ ] Motion gifts: dew/star/rain khác nhau; wheel chốt đúng index/target; meteor1/quake≤3 có bay/tác động/shield/no-target/broken8s/replant. Boss quà vào arena; chốt phiên/showTop5 có identity.
- [ ] Browser kiểm chuỗi pha và state thật ở từng tác vụ; reload giữa phase, source tabẩn, target rời trước khi phát và reduced-motion phải đúng kết quả. Một hình cuối không đủ chứng minh animation.
- [ ] Chạy tests liên quan; gate: từng dòng ma trận motion trong spec có chuỗi bằng chứng và hook cue, không bỏ sót tưới/hái/bón/sâu/cỏ.

### T07 — Catalog, chuẩn bị asset và engine sample có thể quan sát

**Files:** tạo `garden/audio-catalog.json`, `scripts/prepare-garden-audio.mjs`, `public/garden/audio/manifest.json`, `LICENSES.md` và file MP3 đã duyệt; sửa `public/sfx.js`; tạo `garden/audio-catalog.test.mjs`, `garden/audio.test.mjs`.

**Interfaces:** catalog schema theo spec6. CLI `node scripts/prepare-garden-audio.mjs --from <curated-directory> [--check]` chỉ import local đã chọn, không tự tải mạng; `--check` read-only. `createSfx(volume=0.3,{manifestUrl='/sfx/manifest.json',onState=()=>{}}={})` vẫn trả callable `play(name,arg,meta?)`, thêm `warmup()`, `stop()`, `setVolume(n)`, `status()`; callable cũ không cần đổi.

- [ ] Viết test catalog36role/50variant, file không trùng sai ID, hash/duration/review/provenance; path traversal bị từ chối; input thiếu không overwrite manifest tốt hoặc asset đang dùng. `--check` không mutation.
- [ ] Chọn/ghi nguồn và nghe duyệt âm hữu cơ, trim/fade/gain; role cùng họ nghe tương đồng, role khác hành động phân biệt. Asset mới thiếu giấy nguồn/review thì báo thiếu, không lấy nguyên pack thô để lấp số.
- [ ] Reuse MP3 có sẵn nếu nghe hợp brief, nhập bổ sung từ thư mục curated. Không thay shared manifest/pack PK. Chỉ export field runtime từ catalog, không đưa thông tin máy cá nhân ra public.
- [ ] Test thêm sample-only role `water` phát khi không có SOUNDS.water; file404/decode error fallback đúng; cache decode một lần/URL; mute0 không tải thừa; context suspended báoblocked, không nhậnready giả.
- [ ] `play` trả handle hoặc null `{stop(),ended:Promise}` để T08 quản lý voice lifecycle, metadata group/priority/cueId dùng để report. Voice=cue/sample instance; synth fallback nhiều oscillator vẫn một logical cue và stop dọn toàn bộ node của cue.
- [ ] Chạy `node --test garden/audio-catalog.test.mjs garden/audio.test.mjs` và `node scripts/prepare-garden-audio.mjs --check`; browser gọi PK cũ và Garden manifest khác phải hoạt động độc lập.
- [ ] Gate: 36 role/50 sample đã nghe duyệt hoặc báo thiếu cụ thể; runtime không phụ thuộc download, fallback/status rõ, shared callers không bị buộc đổi API.

### T08 — Cue theo phase, mixer và chống chồng tiếng

**Files:** tạo `public/garden/audio.js`; sửa `public/garden/garden.js`, `public/music.js` để hỗ trợ mức nền/state cần thiết mà giữ API cũ; mở `garden/audio.test.mjs`.

**Interfaces:** `createGardenAudio({music,sfx,now,onState})` trả `warmup()`, `cue({role,eventId,sceneId,phase,count,ageMs})`, `setLevels({master,music,care,event})`, `mute(on)`, `stop()`, `status()`. Nhận phase thực T02/T06; không enqueue native game action.

- [ ] Fake-clock/fake-engine test cap 6 voices, care≤3/event≤3, starts≤8/s; cue quan trọng ngắt care cũ, không để care làm mất wheelResult/bossWin. Không lặp variant liên tiếp nếu pool>1; fallback cũng tính cap.
- [ ] Test dedupe ID+phase; gộp 48 water/count, bossHit180ms; care age>500ms không replay, context unlock không xả backlog. `softBlocked` chỉ dùng test/control mặc định, không phát mỗi lỗi ở LIVE.
- [ ] Controller giữ duck leases, tính mức nhỏ nhất còn hiệu lực và gọi API cũ `music.duck(amount,ms)`; hết lease gọi `duck(1,0)`. Thêm `music.setVolume(n)` và `music.status()` cho mixer. Test cue nhẹ không xóa duck boss; cancel/scene end/mute/session reset dọn voices/timers/duck, nhạc về baseline; callers PK vẫn đúng.
- [ ] Nối 36 role vào bảng action/scene theo spec; T04 notification nhiều mốc dùng một role mạnh nhất; rain event với gift rain không tự chồng hai cue. Không phát âm mỗi tim/comment hoặc mỗi hàng rank đổi.
- [ ] Tách gain 4 bus theo spec, tôn trọng URL music/sfx cũ. Test music0/sfx0, resume denied, missing assets; UI/native không bị audio exception làm đứt.
- [ ] Chạy `node --test garden/audio.test.mjs`; browser warmup/blocked/mute/loop/burst/scene cancel; nghe bản mix yên/đông/quà/boss/awards trên máy phát ở T11.
- [ ] Gate: phase hình có cue có nghĩa, không double-play khi reload; mức chói/chồng/khó chịu phải được đánh giá bằng nghe thật.

### T09 — Control và diagnostics của đúng nguồn LIVE

**Files:** `garden/server.mjs`, `public/garden/garden.js`, `control.html`, `control.css`, `control.js`; tạo `public/garden/audio-library.js` nếu tách UI catalog; test `garden/display.test.mjs`, `server.test.mjs`.

**Interfaces:** `POST /api/display-status` nhận `{clientId,role,build,scene,queues,idle,audio,fps,visibility}`, whitelist payload≤8KiB, role live/preview, heartbeat1s. `GET /api/status` thêm `displays` tạm thời: cap8, stale3s, expire30s. Reuse localhost/origin guards, không lưu telemetry vào garden-state. `display=preview` ép audio0; `display=live` được monitor riêng. Host có thể loại entry stale khỏi danh sách nguồn cần theo dõi qua local API, không dừng tiến trình nguồn.

- [ ] Test malformed/oversized/unknown role/cross-origin bị từ chối, client expiry/cap, không lộ secret/save; build stamp phản ánh mã server/asset được nạp, không chỉ file timestamp.
- [ ] Test hai client khác phase/queue: control hiển thị riêng LIVE/preview; iframe stale không làm mất cảnh báo LIVE; nguồn LIVE stale chặn phụ T02. Không có client LIVE ghi “chưa quan sát nguồn phát”, không giả queue0.
- [ ] Desktop đặt preview/monitor gần nút thử, action/log cuộn riêng; mobile dùng tab Thử/Xem/Log/Âm thanh với scene summary luôn thấy. Không thêm debug trên overlay.
- [ ] Thư viện âm: nhóm/tìm cue, play/stop từng sample, xem metadata/fallback, chỉnh 4 mức, mute, thử mix; mặc định nghe ở control riêng và preview câm. Muốn nghe qua nguồn LIVE phải chọn đích và báo rõ, không tự bật hai nguồn.
- [ ] Monitor scene/phase/event/target/queue age/reason/drop/idle/audio/voice/fallback/autoplay/build; phát hiện nhiều nguồn LIVE có tiếng để host xử lý. Không tuyên bố đang nghe được nếu chỉ AudioContext ready.
- [ ] Chạy `node --test garden/display.test.mjs garden/server.test.mjs`; browser desktop1600/1280 và390px, nguồn độc lập; gate: host đối chiếu được bấm→native→cảnh→âm của nguồn đang thu.

### T10 — Simulator có kịch bản phủ cơ chế

**Files:** `garden/server.mjs`, `public/garden/control.js`, `control.html`; tạo `scripts/garden-rehearsal.mjs`; test `server.test.mjs`, `interaction.test.mjs`, `presentation.test.mjs`.

**Interfaces:** giữ `POST /api/sim`, `sim-room`, `boss`, `reset` simulator-only. Thêm `POST /api/sim-scenario` chỉ simulator với scenario enum, seed, runId; trả timeline expected/native event IDs; cancellation dừng timer fixture. Không nhận JS hoặc đường dẫn từ request.

- [ ] Fixture xác định được: newcomer1, group4, room12/24/48, careburst48, cardspam100, giftburst30, bossinterrupt, shield/no-target/destruction, awardreload, audioquiet/busy. Chỉ thao tác state trong temp/sim có backup/restore, không chỉnh vàng/LV phòng thật.
- [ ] Preset1/5/50/100/500/1.000 + diamonds×count; các biên49/50/99/100/499/500/999/1.000, sender không slot/full room, quà giữa awards/boss, khiên ngăn phá/crop trống. Chọn đúng identity đang test.
- [ ] Script offline khởi server port0/temp dir/tiktok:false; có timeout, cleanup trong finally và assertions. Không tự dùng4858 hoặc đổi phòng user đang chạy. Xuất report R-ID/eventID/nativeResult/ảnh phase/audioStatus.
- [ ] Test route normal mode403, fixture cancel/repeat không làm timer chạy ngầm; scenario fail không reset toàn save. Chạy các test nêu trên rồi offline rehearsal.
- [ ] Gate: host chạy lại đúng tình huống và biết expected/actual; mọi R-ID có scenario hoặc kiểm tra thủ công rõ.

### T11 — Preflight và nghiệm thu TikTok LIVE Studio

**Files:** `garden/README.md`, `ops/live-studio-garden/{README.md,source-reference.json,overlay.url,control.url,offline-preflight.json}`, readiness control ở T09; tài liệu lịch sử trỏ về thiết kế mới làm chuẩn.

**Interfaces:** checklist states `pass|fail|not-checked`, evidence path/timestamp/revision/mode. Không suy ready từ HTTP200/unit tests; API key chỉ báo configured, không connect để test.

- [ ] Hợp nhất hướng dẫn: Garden4858, đúng lệnh `garden/garden:sim`, source URL có `display=live`, preview ép mute, canvas1080×1920/30fps đề xuất, data/backup; không dùng OBS hoặc PK check thay Garden.
- [ ] Thiết lập nguồn trong Studio theo UI có thực: web source nếu hỗ trợ hoặc cửa sổ overlay9:16; control ngoài capture, một đường Garden audio + mic. Không ghi đè private DB, encoder hoặc bitrate chưa thử.
- [ ] Đo vùng UI TikTok che bằng nguồn/điện thoại thực, lưu ảnh; chỉ sau đó chỉnh insets. Không áp số safe-area cũ làm mất full-frame đã yêu cầu. Nếu chưa có điện thoại/phát thật ghi not-checked.
- [ ] Nghe đủ50 sample và bản mix yên/đông/quà/boss/awards; test blocked/missing/fallback, headset/speaker/mic, không clipping/lặp/nhạc lấn lời. Review catalog khác với xác nhận âm thu được.
- [ ] Diễn tập15–20 phút trên máy Studio đang encode, đo đáp ứng p95≤500ms, medianFPS≥30/p95 frame interval≤50ms theo spec; log máy/tab visibility và hạ particle nếu cần, không lấy số từ headless để nghiệm thu.
- [ ] Khi chuẩn bị LIVE thật, backup rồi dừng đúng sim để chuyển cùng port; xác nhận simulator:false; tài khoản phụ thử comment/tim/quà và reload/reconnect, không retry signing vô hạn. Nếu chưa LIVE thì để gate pending và vẫn bàn giao phần local.
- [ ] Gate: checklist nói đúng điều đã chứng minh; không còn hướng dẫn OBS cho đường đi hiện tại.

### T12 — Review toàn phạm vi và bàn giao

**Files:** bảng R-ID, toàn diff đợt triển khai, evidence/rehearsal report, tài liệu chuẩn.

**Interfaces:** mỗi R-ID → code/task → bằng chứng tự động/thủ công → status → limitation. Report tách Git/tests/browser/audio Studio/LIVE.

- [ ] Duyệt từng R01–R28, từng role âm và dòng motion; không đánh dấu đạt khi còn “có code” hoặc “chưa nghe”. Trả lỗ hổng về task chịu trách nhiệm, không chỉ thêm dòng rủi ro.
- [ ] Chạy `node --test --test-concurrency=1`, `node scripts/prepare-garden-audio.mjs --check`, rehearsal offline một lần sau thay đổi cuối; so PK shared audio và save migration. Không lặp full suite khi chưa có thay đổi/failure mới.
- [ ] Review save/restore, local permissions, asset paths/provenance, clocks/replay, nhận diện/anchor, performance và tiếng thực. Có review độc lập trước khi tuyên bố hoàn tất triển khai.
- [ ] `git diff --check`; ghi rõ file đã sửa thuộc đợt này, không nhận toàn bộ dirty tree là sản phẩm mới. Không tự commit/push/release.
- [ ] Bàn giao host cách chạy rehearsal, kho âm, nguồn LIVE, cảnh báo stale/fallback, chuyển mode và rollback code/save có backup; liệt kê gate LIVE pending nếu có.

## Definition of done

Không còn R-ID không có task; không còn P1 đã tái hiện; cue/motion đúng target/phase và không replay; 36 role/50 sample được review hoặc báo rõ phần chưa giao; host quan sát đúng nguồn đang thu; toàn bộ nghiệm thu local có evidence. Chỉ gọi **sẵn sàng LIVE đầy đủ** khi cả Studio/điện thoại/sự kiện thật đều pass; phần nào chưa thể kiểm thì ghi not-checked, không gọi triển khai hoàn tất toàn bộ.

## Handoff

Lựa chọn đề xuất: triển khai tuần tự trong cùng phiên bằng `superpowers:executing-plans`, review ở cuối từng nhóm T01–T02/T03–T06/T07–T10/T11–T12. Các module giao nhau nhiều, tránh nhiều implementer sửa chung garden.js/server.mjs. Thiết kế và task là bản để người dùng review trước khi viết product code.

## Kiểm tra chất lượng tài liệu lần lập kế hoạch này

- Đối chiếu source qua CodeGraph, inventory audio đọc local và Git branch `feat/garden-full-frame`, HEAD `dbf6895`; không thay runtime hoặc dữ liệu người chơi.
- Builder check độc lập đã đọc spec và bảng yêu cầu: toàn bộ R01–R28 được thể hiện, không còn câu hỏi sản phẩm quan trọng ngăn lập kế hoạch. Gợi ý về nhiều nguồn LIVE đã được chốt vào spec/T02/T09 theo điều kiện bảo thủ và fallback preview chỉ cho simulator.
- Self-review: 28 hàng yêu cầu đều trỏ tới task hợp lệ trong 13 task T00–T12; link Markdown nội bộ hợp lệ; `git diff --check` qua. Đây là kiểm tra tài liệu, không phải pass các task triển khai.
- Không chạy lại suite601 trong lượt viết kế hoạch. Chưa chọn/tải50 asset mới, chưa nghe duyệt sample hoặc mix trong Studio; các số nghiệm thu trong task là mục tiêu, không phải kết quả đã đạt.
