# Removed source report

No source files were deleted from Git HEAD in this pass, because verified consumers for legacy Scene Set/Story Symbol paths have not yet been exhaustively established. Deleting them now could break existing Job@5 imports or plugin compatibility.

The candidate plugin package **excludes 207 nonexecution source/test/cache candidates** while preserving Git HEAD and its CI test suite. This does not count as deleting obsolete implementation from Git.

Future deletion gate: identify exact remaining imports and runtime consumers, migrate callers, run legacy Job@5 import regressions, then delete confirmed DEAD/OBSOLETE/DUPLICATE files by explicit commits. Do not archive every retired file.
