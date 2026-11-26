# Adding concepts to experimental Studio

When the user says "bổ sung thêm concept", update `idea_catalog.json` here.
This is the only concept catalog used by both the Ideas GUI and MP4 review GUI.

- Place each new concept under the best existing group; add a group only when
  the requested topic needs one. Groups have `id`, `title`, `subtitle`, `concepts`.
- Each concept has a stable, unique lowercase ASCII `id` (letters/digits/hyphens,
  at most 80 characters), a Vietnamese `title`, and a concrete `direction`.
- Preserve existing IDs, sign names, concepts and directions unless the user
  explicitly asks to revise them. Progress is keyed by concept ID and sign;
  never rename IDs to improve wording and never edit the progress database.
- Check for existing equivalent ideas before adding duplicates. Match the
  user's topic and tone; do not invent production completion or approvals.
- No React/Rust changes or hardcoded concept counts are needed for additions.
  Python reloads the catalog per read; GUI refreshes when focused or when the
  user presses "Làm mới". MP4 review reads the same groups/concepts.

Validate from the main2 repository root:

```powershell
python -m tools.studio_project.ideas
python -m pytest tests/test_studio_ideas.py -q
```

Completion is only the user's checkbox in "Xem & duyệt MP4" after they watch the
final video. Updating the catalog or copying an agent prompt never completes it.
