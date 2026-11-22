# Ideas and progress in experimental Studio

User approved implementation and defined completion as an MP4 they have reviewed
and approved. Add a global Ideas & progress view to main2, accessible before any
episode is imported. Production main remains unchanged.

Seed the ten supplied love concepts, eight supplied everyday/meme concepts, and
ten new injury/breakup/healing concepts. Preserve supplied titles and directions.
Each concept tracks all twelve zodiac signs independently. Only an explicit user action marks approval; this
is a personal production checklist, not a pipeline approval receipt.

Selecting a concept copies a Vietnamese agent prompt including its direction,
completed signs and eligible signs. The agent selects a sign; the application
does not randomly choose one. Prefer untouched signs over work already started.
Never mark progress on copy; stop copying when all twelve are approved. Provide
a visible prompt preview/manual copy path and report clipboard failure honestly.

Copied prompts explicitly route creative Phase 1 to **@Zodiac-Video-Web** and
`zodiac-video-web:zodiac-video-web`, requiring the current skill and related
references rather than substituting a generic Zodiac workflow. Preserve its six
microphases, identity/editorial/performance gates, genuine Content Review and
approved handoff boundary. Plugin availability is required before authoring;
the agent requests attachment if missing. The UI must explain that copying plain
text does not attach the plugin: select it in ChatGPT before sending. Concept
progress remains advisory and never grants creative approval.

Use existing React/Tauri/Python transport and SQLite registry. Store progress
outside episode authoring files so reopening preserves it. Validate identifiers,
signs and status at the Python boundary. No new dependencies, automatic agents,
release build or production rendering. Keep the one-frame layout, shared paging,
keyboard controls and readable status labels.

## Approved simplification and final MP4 review

The user requested a simpler UI and confirmed a separate MP4 viewing tab.
Use a single full-width concept list with group filter and search. Selecting a
concept copies the prompt and opens a detail page with read-only sign progress.
Remove the twelve status dropdowns. A back button returns to the same list page.

The separate Xem & duyệt MP4 view opens a user-selected local MP4 using the browser
File/Blob API, without reading arbitrary paths or uploading media. The user picks
the concept/sign and manually ticks approval after viewing; valid video metadata
is required before enabling approval. Opening/playing media never approves it.
This is a personal checklist, not a cryptographic pipeline approval receipt.

Catalog-only additions require no React edits or native rebuild. Read the JSON
again on every list/update request, validate structure/unique stable IDs, and
refresh the GUI on focus or Làm mới. Root/scoped AGENTS.md documents the workflow
for future "bổ sung thêm concept" requests. No catalog editor or automatic
matching to imported episodes in this increment.
