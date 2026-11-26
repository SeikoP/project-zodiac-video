## CodeGraph

In repositories indexed by CodeGraph (`.codegraph/` at the repo root), use
`codegraph_explore` before grep/find or reading code to understand or locate it.
If the index belongs to another worktree, inspect this worktree's current files
directly. Do not create an index unless the user requests one.

## Main2 concept library

When the user says "bổ sung thêm concept" or asks to extend Studio ideas, read
`tools/studio_project/AGENTS.md`, then update
`tools/studio_project/idea_catalog.json`. This is the single catalog used by both
the Ideas GUI and the MP4 review concept picker. Do not add hard-coded GUI rows.

Preserve existing IDs and all progress. Add meaningful Vietnamese titles and
concrete directions to the appropriate group, avoiding existing concepts. Follow
the requested topic/count; for an open request choose a small useful batch.
Validate the catalog and run the focused tests before reporting added concepts.
The GUI reads changes on focus, on opening the tab or via Làm mới; no app rebuild
is needed for a catalog-only edit. Never mark a concept/sign approved on behalf
of the user when adding ideas.

## Task completion and remote handoff

For each completed roadmap task, run its required checks, update the roadmap
and evidence with actual results, then commit and push that task to the current
working branch so remote collaborators can inspect and repair it. This is
authorized by the user; do not ask again for routine task commits/pushes.

- Keep commits scoped to the task and its required dependencies. Inspect and
  preserve pre-existing dirty changes; never use blanket staging, reset, clean
  or force-push to make a handoff appear complete.
- Fetch/check the current branch's remote tip before pushing. Preserve remote
  work; resolve integration safely and rerun affected checks if it changes code.
- Do not commit secrets, local credentials, ignored runtime stores, caches or
  generated media. Record reproducible steps and artifact hashes/paths instead.
- Report the commit and pushed branch. If push fails, state the exact blocker;
  local commit success is not remote delivery.
- Technical completion does not grant human voice/visual/video approval.
  Leave those gates PENDING without genuine user evidence. Release builds,
  installers, publication and merging into production still need authorization.
