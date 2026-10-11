# Thiết kế tối giản asset và Phase 2 Zodiac

Ngày 11/10/2026. Trạng thái: thiết kế để triển khai, chưa sửa plugin/runtime. Nguồn yêu cầu: hội thoại Kim Ngưu và backlog A01–A33 trong zodiac-ke-hoach-cai-tien.md. Phương thức đề xuất: native, tuần tự, không subagent.

## Mục tiêu đã chốt

Làm ít quyết định thị giác hơn nhưng kể rõ hơn. Giữ nhân vật có bản sắc, nét doodle V4, tỷ lệ và contact đúng, animation nhẹ có lý do. Kho phong phú không đồng nghĩa mọi video phải dùng nhiều thành phần. Giữ ba phase hiện tại; không thêm phase hoặc engine mới.

Khung được lấy trực tiếp từ gói ZIP, không vẽ lại hoặc thêm bóng/gradient/lực bút mới. Tường và sàn được giữ, chiều sâu là bố cục 2D. Chi tiết background phụ không được tự sinh. Các chi tiết nằm sẵn trong SVG đã chốt không bị lọc âm thầm: bản giản lược nếu cần là derivative riêng có before/after, không gọi nguyên gốc.

Hai reference đã đối chiếu được giữ riêng, không đánh đồng: ZIP cũ S03-cafe-school-warm.svg, SHA256 081abe8b09e865c5f137100291f7ad28a94d8b39a604d5912e3fbb6d41d8edc4, transform 1080×900; ZIP hiện tại living-room-home-space.svg, SHA256 dc7e7ef67fd7f0d2409dd7a5557a2a2b32438045975d36f2a603499a0a94f3b8, transform 1080×950. Preset trỏ rõ asset/hash/transform đã chọn; không tự chọn lại reference theo ký ức. Review canvas 1080×1920, clipping/aspect theo renderer, không đổi crop để làm mẫu đẹp hơn.

## Phương án chọn

1. **Thu nhỏ bộ mặc định và authoring, giữ kho tương thích — chọn.** Không xóa assets cũ. Index nhỏ giới thiệu core; extension chỉ được nạp theo nhu cầu. Quyết định sáng tạo viết một lần; compilers sinh các projections mà native gate đang dùng.
2. Xóa phần lớn kho và viết lại engine: ít file nhưng rủi ro mất bản sắc và phá legacy; không chọn.
3. Giữ kiến trúc và thêm preset/validator để bù: nhanh nhưng tiếp tục tăng context và sửa dây chuyền; không chọn.

## Ranh giới thiết kế

### Kho và khung

Core gồm nhân vật/component có bản sắc, state cần cho hành động, đạo cụ kể chuyện và khung đã kiểm. Extension gồm meme/effect/environment cue được chọn rõ. Compatibility gồm assets đang được job cũ tham chiếu. Đây là chính sách lựa chọn, không nhân bản hoặc di chuyển bytes asset. Không áp quota pose/frame/SVG. Chỉ bổ sung pose ngồi/nằm và contact tay–bút khi bộ hiện tại thực sự không diễn được câu đã duyệt; không thêm catalog rộng trong đợt này.

Một khung có thể dùng tiếp qua nhiều paragraph. Scene narration, bố cục và state event là ba khái niệm khác nhau. Chuyển động do runner thực hiện; không sinh thêm SVG chỉ để mô phỏng tween, không tự giả engine animate limb groups.

### Authoring Phase 2

Luồng người/agent dùng: ý hình → bố cục/diễn xuất → compile và review. Native vẫn giữ các bước manifest và receipts cần thiết. Đề xuất một authored visual-intent chứa scene references, cast identity choices, frame reference, semantic props, meaningful events và quyết định Story Object. Nó không sao chép narration; dùng scene_id, voice_anchor và narration hash. Compilers chiếu sang production@2.0, assembly@2, grammar@1, asset-plan và các director/art-direction/cast plans hiện hành.

Không tạo hai source cạnh tranh: workspace mới dùng visual-intent; workspace legacy chưa chọn mode này dùng native inputs hiện hành. Không tự migrate approved workspace. Projection có source hash, owner và compiler version; sửa projection tay bị phát hiện. Compilers không sáng tác metaphor/action/palette thay agent.

### Story Object

Vật phải diễn cơ chế tâm lý hoặc mâu thuẫn nhìn thấy được. Đạo cụ tình huống có thể kiêm Story Object. Không bắt thêm vật thứ hai hoặc một icon riêng. Repeated reveal cùng hình không chứng minh setup/friction/payoff khác nhau. Gate kiểm structural progression và actual state trace; người review kiểm mute-read và added meaning.

Chính sách mới explicit required/optional/omitted trong authoring. Omitted phải có lý do biên tập, không do thiếu asset hoặc để vượt gate. Legacy required giữ nguyên. Không đổi narration đã duyệt để cứu một metaphor yếu. Memory_menu hiện tại chỉ là fixture negative review, không tự thay bằng một object mới được coi là approved.

### Điều phối và hợp đồng

Kiểm layout/density/contract trước Visual Review, dùng cùng quy tắc như handoff. Giữ Job@5 và renderer@2.0.1; không tăng schema cap để chữa clutter. Bảo toàn narration exact bytes khi resegment bằng source ranges; không thêm newline hoặc normalize Unicode. Preview tích lũy states theo event order; event before không khớp state trace phải báo lỗi.

Source policy duy nhất, source root được xác minh; approval bound hashes; invalidation theo dependency graph. Locks có owner/run/time và recovery chỉ khi xác nhận stale. Phase3 export vẫn một entrypoint/một ZIP; state và ZIP-bound receipt phải được hòa giải sau crash, không tạo receipt PASS giả.

### Content và context

Fresh scoped Narrative 2.1, legacy approved 2.0 không tự migrate. Helper duration có tồn tại, chỉ estimate khi chưa có audio. TTS text readiness trước Content Review; phản biện evidence/identity/motif trên toàn bài. Nạp index nhỏ và guidance theo lựa chọn; invariant validators luôn giữ. Compiler/library PASS, episode static PASS, human approval và media QA là các lớp khác nhau.

## Điều kiện nghiệm thu

- Khung reference không đổi source SVG/hash/viewport do demo hoặc compiler ngoài revision có chứng cứ.
- Scene không chọn kiến trúc phụ không sinh cửa sổ/bảng/đèn. Semantic furniture vẫn giữ role và tỷ lệ.
- Một quyết định entity/event thay đổi chỉ sửa author input; projections đồng bộ và stale review bị invalid.
- A reveal → B đổi → A callback giữ B mới trong preview; rename cùng hình không được tính semantic progression.
- Hai/ba nhân vật, contacts, prop budget và caption zones được kiểm trước approval, không chờ export mới lỗi.
- Mẫu Story Object yếu trả NEEDS_REVISION, object hợp lệ hoặc omit có lý do không bị ép thêm SVG/effect.
- Context bytes giảm trên ca không dùng extension; số output chỉ được giảm khi giữ hành động và khả năng đọc hình. Không dùng số SVG ít làm tiêu chí duy nhất.
- ZIP thật được Python runner import validator kiểm không mock; producer/runner schema hash khớp; unknown hash vẫn bị chặn và log expected/actual/path.
- TTS/prosody, word timing, contacts chuyển động, caption/cover pixels, audio và MP4 chỉ PASS khi có evidence runner thực.

## Ngoài phạm vi

Không mở thêm kho lớn, không thử bóng/nét tiếp, không xóa legacy, không đổi engine/schema Job5, không viết lại narration, không phát hành plugin trong lượt lập kế hoạch. Không đòi TTS/MP4 để gọi producer ZIP-ready, nhưng không gọi ZIP-ready là video-ready.
