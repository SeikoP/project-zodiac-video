# Zodiac Studio — Background Music Library, Semantic SFX and Audio Mix V2

> **Status: DESIGN / NOT IMPLEMENTED · 2026-11-14.** Parent: [Unified Studio](./2026-11-14-agent-native-creative-studio-design.md), [Visual V5](./2026-11-14-zodiac-visual-v5-color-system-design.md), [Contract Version Audit](../../audits/2026-11-14-version-upgrade-candidates.md) and the [eight-phase roadmap](../plans/2026-11-14-unified-zodiac-studio-roadmap.md). No copyrighted music/SFX files are added to Git in this docs PR; no test listening, licensed-media procurement, final audio listening or render QA has been performed.

## 1. Verified existing code, asset catalogs and blockers

- `tools/studio_v2/executor.py::_default_audio_handler` already mixes final visual MP4 + `voice.wav` and **optionally ONE looped music track**, with FFmpeg `amix=inputs=2`, `volume` default 0.2 and `voice_volume` default 1.0. This is a functional basic music path, not a semantic audio director. No per-event SFX, timing-bound cues, ducking or scene-level automation is in that handler.
- `tools/zodiac_local.py::default_music_path` points to `assets/music/background.mp3` **only if it exists**. The GitHub main tree inspected did not contain that MP3. Silence when there is no valid local track is a valid outcome.
- `tools/livestream-pk/audio-pack.json` catalogs **16 Mixkit music tracks** (metadata presently concentrated in `upbeat`) and Mixkit SFX categories; `assets/music/livestream/LICENSES.md` records URLs/attribution/license. The inspected GitHub main tree did **not** contain the listed MP3 files. **Do not claim those tracks are physically bundled/available in Studio.**
- `tools/livestream-pk/public/garden/audio` does have separately committed **50 original procedural CC0** WAV files and `LICENSES.md`. These are mostly game/garden cues (watering, achievement, weather, etc.) and should not be indiscriminately reused for TikTok narration.
- The existing live garden/SFX and music libraries are **a source to inspect**, not a license to bundle copies in a released standalone video editor. Mixkit's official Stock Music Free and Sound Effects Free licenses allow use **within** social video; SFX explicitly forbids standalone redistribution in tools/templates/source packages. Music similarly has reuse/rights-management restrictions. See https://mixkit.co/license/modal/musicFree/ , https://mixkit.co/license/modal/sfxFree/ and https://mixkit.co/terms/ . Confirm per-item terms and destination-platform rights; do not register these tracks in Content ID.

## 2. Design choice and audio identity

**Yes to a purpose-built background-music catalog. Yes to optional, sparse, story-anchored SFX.** The voice is always primary; sound should support information reveals and comedic timing, not provide relentless noise. No mandatory SFX per scene or “more sound effects = higher engagement” premise.

Retain current FFmpeg mixing path as a **legacy fallback** and create one versioned Audio Design subsystem instead of a new separate DAW, music generation service or parallel audio renderer.

**Music catalog should cover distinct *narrative functions*, not zodiac-sign IDs. Proposed initial buckets:**
1. `playful-everyday`: light, rhythmic, natural social story.
2. `dry-comedy`: sparse bass/percussion/quirky instrument, deadpan voice intact.
3. `curious-neutral`: unobtrusive inquiry, social observations.
4. `sneaky-investigation`: restrained detective/Scorpio mood without overpowering voice.
5. `tension-build`: subtle rising pulse for withheld evidence/payoff.
6. `warm-resolution`: understated ending and reflection.
7. `high-energy-contrast`: occasional transitions/hooks, not the entire episode by default.
8. `minimal-ambient`: subtle texture or near-silence when words carry the video.

*Editorial selection* based on narrative, voice pace, speech density, permitted platform and prior track use, not random rotation. The catalog must include **a true silence option**. Start by indexing existing 16 metadata rows; reject missing files as unavailable, add genuinely different legally usable tracks only after listening. Target 3–5 **auditioned** tracks per major bucket as a later content-expansion goal, not a promise to auto-download/relicense or an arbitrary requirement for first executable test.

**SFX catalog has semantic roles:** `object_contact` (phone tap / paper slide / door click), `attention` (subtle tick/snap), `reaction` (tiny pop/hesitation), `reveal` (restrained punctuation), `transition` (brief soft whoosh), `environment` (situational room tone, only if narratively required). Each cue is opt-in, tied to an approved beat or visual action, has a specific reason and may be removed. Avoid laugh tracks, nonstop swishes and generic game achievement sounds by default. Prioritize a small reviewed **micro-SFX kit** (roughly a dozen distinct reusable cues) over a huge uncurated directory.

## 3. One lawful media registry with actual file integrity

**Proposed source-defined `zodiac-audio-library@1`** (catalog, not another Job@5 authoring source) contains:
- ID, name, creator, type (`music`/`sfx`/`ambience`), semantic tags, tempo/bpm only when observed, intensity, duration, start/end/loopability and preview compatibility.
- Exact local media path **or** source URL for authorized user import, format/sample rate/channels, duration from actual media probing, SHA-256 bytes and normalized preview waveform/cache.
- Per-item `license_id`, source URL, license snapshot/retrieval date, permitted usage/platforms, attribution requirements, whether raw file embedding/redistribution is permitted, and explicit `rights_status` (`VERIFIED`/`RESTRICTED`/`UNKNOWN`); never rely on an unaudited folder-level guess.
- Disk-backed lazy waveform/preview import, without eager decoding/loading dozens of tracks into weak Windows RAM.
- Status `CATALOGED` (metadata only), `FILE_MISSING`, `IMPORTED`, `VALIDATED`, `RESTRICTED` and `RETIRED`. Metadata alone is **not** a playable BGM in Studio.

**License safety:** User may use Mixkit music/SFX within finished social videos under the linked licenses; **do not redistribute licensed source media as a standalone audio library**, include raw Mixkit files in a publicly shared Studio release, or embed them in portable Job@5 ZIPs without separately verified permission. Store asset refs/fingerprints/rights receipts in project/package, keeping third-party raw audio in authorized local user library. An actual final MP4 that incorporates music/SFX is distinct from raw-source redistribution.

**Reuse:** CC0 originals from live garden can be referenced by hash/role after listening and artistic review. Never merge live gaming audio into short-form episodes silently.

## 4. Versioned audio design: anchored to approved voice, not guessed frames

**New `zodiac-audio-design@1` is a project authoring plan** linked to ONE approved voice-take/timing revision; it is not a rewrite of Phase 1 approved narration or another video Visual Intent owner.

```json
{
  "format": "zodiac-audio-design@1",
  "voice_artifact_sha256": "sha256-of-approved-voice",
  "timing_sha256": "sha256-of-measured-timing",
  "music": [{"track_id": "track-id", "in_ms": 0, "out_ms": 64000, "gain_db": -20, "fade_in_ms": 450, "fade_out_ms": 800}],
  "cues": [{"id": "cue-01", "source_event_id": "E_REVEAL", "asset_id": "sfx-soft-reveal", "offset_ms": 0, "gain_db": -15, "optional": true}],
  "master": {"ducking": "voice_priority", "limiter": true, "clip_protection": true}
}
```

This is a **shape example**; hashes and IDs here are placeholders, not real approved media. Exact schema/limits become fixed in the audio implementation plan. Every time reference is measured milliseconds from the approved voice/episode timeline, or a typed `voice_event_id` with a bounded offset; convert to frames only at the render/export adapter. A regenerated take invalidates time-dependent cue references but not cached SVG/asset artwork. Missing cue asset rejects required cues and visibly omits optional cues; neither makes a fake audio PASS.

**Sound direction** can be suggested by the agent from story beats (e.g. prop contact / reveal) but MUST be previewed via actual sound playback. It must not invent license permission or assert the selected cue sounds good without listening.

## 5. One reusable FFmpeg audio renderer, not a second visual renderer

Audio V2 uses **a single final multitrack master**:
1. Verified narration `voice.wav`, selected actual take and measured breathing pauses, never altered/re-synthesized due to music/SFX edits.
2. Optional BGM bed or at most a small number of authored music transitions; source assets loop/trim only as permitted and needed.
3. Sparse event-bound SFX and optional ambience with measured start/end.
4. Voice-first gain staging, **dynamic ducking** (prefer automation envelope or FFmpeg `sidechaincompress` driven by the actual voice track), short fades/crossfades, limiter/true-peak checks and segment continuity without timing drift.
5. Technical QA: file exists, duration matches timeline within explicit tolerance, no significant clipping or silence where dialogue expected, voice intelligible at default mobile listening, events within scene boundaries, no missing required licensed file and real user listening/review.

FFmpeg documentation: https://ffmpeg.org/ffmpeg-filters.html (filters: `amix`, `sidechaincompress`, `afade`, `loudnorm`, `adelay`, `alimiter`, `atrim`). Pick actual threshold/ratio and loudness only after testing actual Vietnamese voice and tracks; **the existing default 0.2 volume is not a universal loudness standard**.

**Critical cache boundary:** media-only edit reuses immutable voice WAV, ASR/alignment, visual scene graph and rendered video-only MP4/segments; it rebuilds **only audio design/mix/final mux** and quality receipt. New final mixed MP4 hash changes, but no full visual rerender. Cue source hashes and mix engine/settings versions participate in the audio mix fingerprint.

## 6. Studio experience and episode pipeline

- **P2 Voice Lab:** real audio listening/approved take remains before visual production; optional simple BGM audition UI may display a few referenced tracks but must not block speech-unit first-pass.
- **P3 Compiler VNext:** performance/event timeline stores **possible sound cue anchors** as derived semantic candidates only; do not insert arbitrary audio files during image compilation. `episode.build` can surface `sound_recommendations` but technical visual PASS does not imply audio review.
- **P4 HyperFrames Studio:** audio-design panel/timeline shows music bed and SFX markers/position, preview uses the same measured voice anchor; semantic edit updates one source, not private editor state.
- **P5 Visual V5/gallery:** add **Audio Library** alongside V4/V5 visual gallery with search/listen/preview/import/license indicators. Share the same active episode. Build first usable catalog from available CC0 originals and locally licensed files, not a fabricated 16-track shipped package.
- **P7 full E2E:** implement Audio Mix V2, cue sync/ducking, actual waveform listening and final mp4 QA; prove music-only/SFX-only edit never rerenders visuals or re-generates voice. Keep old music-path-only default handler as fallback for Job@5.

**No ninth phase**; V5 and Audio Design are correctly bounded vertical capabilities inside the existing eight gates.

## 7. Acceptance / negative tests

1. Only approved voice exists: audio produces a valid **voice-only** MP4; no need to invent music or SFX.
2. One imported licensed track selected: FFmpeg loops/trims and ducks music below intelligible speech; no default excessive gain, clipping or jump at cut.
3. Sound cue bound to a true measured `E_REVEAL` anchor: marker/audio aligns within declared tolerance and does not play *before* the twist.
4. Audio candidate license UNKNOWN/FILE_MISSING: cannot be marked publish-ready or inserted silently; report reason and valid alternatives, preserve previous audio.
5. Silence/intentionally no-SFX episode is a first-class successful design; no fixed quota.
6. SFX and/or music change invalidates only audio mix/master output and publish artifact, not approved take, ASR/timing, geometry, scene preview nor video-only rendered segments.
7. Retake changes timing/voice: sound cue anchored to the moved event is re-resolved, and bad references are blocked for review rather than guessed.
8. Rapid pause/review and canceled audio render preserve last healthy exported MP4 and true user listening status.
9. Reopen old completed Job@5 ZIP with one music path/old mixing still works through compatibility adapter, no unapproved V5 asset injection.
10. Current CC0 garden SFX and Mixkit catalog import statuses are accurately distinguished; third-party raw assets never appear in release/ZIP by default.

**STOP:** any background music obscures the story, sample license is unknown but status says publish-ready, a silent SFX file appears as valid, or a music-only edit triggers a full video render/TTS regeneration.
