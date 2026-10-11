# Episode scope — Phase 1 mở

Fresh 2.4.50+ đặt `flags.episode_selected=true` trước Evidence. Chọn research pool 1–6 member, không nạp 12 hồ sơ. Giữ engine `character_deconstruction`; format chỉ tổ chức trải nghiệm.

| Format | Final members | Chọn khi |
|---|---:|---|
| single_sign | 1 | Một bản sắc đủ gánh luận điểm |
| element_group | 3 | Chung nguyên tố, khác động cơ |
| ranked_shortlist | 2–5 | Có tiêu chí biên tập thực sự phân biệt thứ tự |
| comparison | 2–4 | Chung trục đối chiếu, không cần thắng thua |

Preset: fire=aries/leo/sagittarius; air=gemini/libra/aquarius; earth=taurus/virgo/capricorn; water=cancer/scorpio/pisces. Dùng ID canonical tiếng Anh, label Việt từ `episode-scope.mjs`; alias chỉ chuẩn hóa đầu vào, không hợp thức hóa duplicate.

## Evidence → Concept

Ghi `.authoring/research-scope.json` (`format=zodiac-research-scope@1`, `topic_question`, `candidate_member_ids`, `permitted_formats`, `source_scope`). Ledger pool bất biến: mỗi entry thêm `member_ids` và `claim_scope=member|element|shared|comparison`. Mỗi member final có ít nhất hai nguồn gốc độc lập thuộc `astrology_interpretation`; element/shared không thay claim member. Phân biệt nguồn diễn giải văn hóa với thống kê hành vi.

Concept ghi `.authoring/episode-scope.json` (`format=zodiac-episode-scope@1`, `episode_id`, `episode_format`, `title_working`, `topic_question`, `member_ids`, `selection_reason`). Thêm `group_element` hoặc `comparison_axis`. Top thêm `ranking.criterion`, `direction`, `basis=editorial_interpretation`, `ordered_member_ids`, `rationale_by_member`, `ordering_counterfactual`; không tạo điểm số giả. Giữ episode_id qua patch.

Tạo ba premise khác nhau cho toàn tập trong `concept-candidates.json`, không ba premise cho mỗi cung. Mỗi candidate có `episode_thesis`, `member_lenses`, `cross_member_progression`, `payoff`, `evidence_refs` và sáu trường chất lượng hiện hành. Lens gồm `member_id`, `identity_mechanism`, `misread_vs_reframe`, ba `archetype_facets`, `evidence_refs`, `sign_swap_test={alternate_sign,irreplaceable_difference}`. Winner có một Story Spine/payoff chung. Run `validate-episode-concept.mjs <workspace>`; structural VALID chưa chứng minh premise hay.

## Draft → Review

Narrative Plan **2.1** dùng `episode_scope` và `member_lenses` thay `sign`; beat thêm `member_ids`. Giữ toàn bộ Story Spine, evidence refs và beat performance. Opening 40 từ chứa title hoặc label một selected member. Nhịp giọng đổi theo diễn tiến và member transition, không chia đều giây hay đọc đủ ba facet mỗi người.

Run `compile-writer-brief.mjs <workspace> --write`: view chỉ selected evidence/lenses; budget 10000 bytes, overflow phải thu gọn có chủ đích. Draft không đọc raw research pool hoặc excluded profiles. Reviewer đọc thêm narration/QC; Zodiac vẫn sở hữu premise/nguồn. Video Lab chỉ leaf guidance theo weakness trong `plugin-use-playbook.md`.

Thêm `episode_identity_review` vào story-quality-review: `scope_sha256`, `member_reviews` đúng final set (`member_id`, `decision=PASS`, `sign_swap`, `distinct_insight`), `group_thesis_review`; Top thêm `ranking_review.order_sha256`. Mỗi criterion có `result`, objection/response thực chất và `evidence_excerpt` trong lời kể thật. Member excerpts chứa label riêng. Reviewer phải thách thức câu generic, đồng nhất nhóm và thứ hạng tùy tiện; validator không tự đánh creative PASS. Vẫn sáu tiêu chí và source hashes hiện hành. Chỉ đến **IN_REVIEW**, cần user approval thật.

## Recovery và production

Đổi members/format/order/source/rhythm → brief và review stale; quay đúng bước, không kế thừa PASS. Member ngoài pool quay Evidence. Resume từ scope durable, không suy đoán từ title/cover. Narrative 2.0 đã duyệt giữ reader cũ.

Phase 2 dùng `.authoring/episode-cast-plan.json` để map member vào entity/scene (`format=zodiac-episode-cast-plan@1`, `scope_sha256`, `bindings=[{member_id,entity_id,scene_ids,role,reason,story_relation}]`); role là member/shared_narrator/symbol; mỗi member được cover, entity resolve tại scene; shared narrator/object phải ghi chủ ý, không đoán một actor là mọi cung. Cover label phản ánh nhóm/Top/trục tập; glyph là presentation. Story Object chung cần quan hệ và added meaning riêng từng member, không ba đạo cụ bắt buộc. Xem `story-object-composition-v2.md` và `cover-composition-v2.md`.

Phase 3 dùng `run-phase03-production.mjs --episode-scope <approved-workspace>/.authoring/episode-scope.json --concept <slug> ...`. Không gán fire/top3 vào `--sign`. Multi ID `zodiac-<episode_id>-<concept>`; ZIP cùng slug, patch chỉ thêm version filename. Job@5 giữ nguyên; research/review không vào ZIP. TTS/timing/audio QA thuộc local runner.
