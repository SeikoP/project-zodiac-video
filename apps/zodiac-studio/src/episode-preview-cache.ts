import { backend } from "./backend";

type Page = { html: string; build_id: string; duration_ms: number; stale: boolean };
const pages = new Map<string, Promise<Page>>();

/** One whole-video page per build, fetched once and kept: opening or playing it again costs nothing. */
export function episodePreview(projectId: string, buildId: string): Promise<Page> {
  const key = `${projectId}:${buildId}`;
  let page = pages.get(key);
  if (!page) {
    page = backend.visualEpisodePreview(projectId, buildId);
    pages.set(key, page);
    page.catch(() => pages.delete(key)); // a failure is retried next time
    for (const old of [...pages.keys()]) if (old !== key && old.startsWith(projectId + ":")) pages.delete(old); // only the current build is kept
  }
  return page;
}
