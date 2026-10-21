import fs from "node:fs";
import path from "node:path";

/**
 * The assembly's shows and series besides the Sabbath classes (data/shows.json): which one a
 * recording or note belongs to, read from its title, and the published index each section of the
 * site and the app is built from. A note's own `collection` frontmatter always wins.
 */

/** The title as said: lower case, without the channel's leading tags ("#IUIC |", "IUIC l", "#IUICNEWORLEANS PRESENTS:") or a leading "(Rerun)". */
export const spoken = (t) => String(t ?? "")
  .replace(/[​ ]/g, " ")
  .replace(/^(?:\s*#?\s*iuic\w*(?:\s+presents)?\s*(?:\|+|\bl\b|:)?\s*)+/i, "")
  .replace(/^\(?re-?run\)?\s*/i, "")
  .replace(/[’]/g, "'")
  .trim()
  .toLowerCase();

export function parseShows(doc) {
  const seen = new Set();
  return (doc?.shows ?? []).map((s, i) => {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(s.slug ?? "") || seen.has(s.slug)) throw new Error(`data/shows.json show ${i + 1}: missing or repeated slug`);
    if (!s.name?.trim() || !s.kind?.trim()) throw new Error(`data/shows.json ${s.slug}: a show needs a name and a kind`);
    seen.add(s.slug);
    return { ...s, match: s.match ?? [], res: (s.match ?? []).map((m) => new RegExp(m)) };
  });
}

export function loadShows(root) {
  const file = path.join(root, "data", "shows.json");
  return parseShows(fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { shows: [] });
}

/** The show a title names, or null: the first in the file's order whose pattern matches. */
export function showOf(shows, title) {
  const t = spoken(title);
  return shows.find((s) => s.res.some((re) => re.test(t))) ?? null;
}
