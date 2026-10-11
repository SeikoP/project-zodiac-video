# Conditional plugin use

Zodiac owns evidence, premise, sign identity and approval. Video Lab does not replace Phase1. Use leaf skill guidance only for an observed weakness:
- hook_promise → video-hook-generator during Concept/review after selecting premise;
- pacing/clarity → video-script-reviewer during native editorial review;
- visual_expression → storyboard-generator during Phase2 before drawing.

Supply actual excerpt, selected premise, intended improvement and constraints. Scores are opinions, not retention evidence. Do not impose hook word counts, CTA, a visual per sentence, new assets per shot or pre-TTS measured timing. Storyboard uses existing native states/bindings; reject unsupported motion. No VideoGen dependency, paid provider or auto switch of renderer is added. Guidance presentation/advertising remains outside narration and production artifacts.

Use plan-plugin-use.mjs <root> --write with plugin-use-request.json {phase,weaknesses:[{kind,excerpt}],availableSkills:[{id,uri}]}. Inventory must reflect observed installed leaf skills. This writes REQUESTED decisions only; it does not claim calls. After real reads, record APPLIED/REJECTED with guidance_uri, skill_read_ref and concrete application_summary; unavailable skill uses NATIVE_REVIEW, no execution proof. For evidence/sign_identity/premise use NATIVE_REQUIRED. Empty decisions are valid when no weakness requires a plugin. Validate without --write before Concept commit. An unresolved request blocks; never call every installed plugin to fill receipts.

Exa/Tavily handle discovery; Parallel or documented fallback corroborates using independent sources. Firecrawl only extracts difficult pages. Content research plugin supplies bounded facets/provenance when needed. Viral/human-touch leaf skills address a named issue and retain their actual origin. vidIQ is optional authorized channel/reference data. Remotion belongs to local preview/render; Superpowers belongs to system development. Do not fabricate plugin execution or independent reviewers.
