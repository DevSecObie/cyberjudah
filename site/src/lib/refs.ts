import { api, bookName, type Book, type Chapter, type Citation } from "@/lib/api";

/** A scripture reference parsed from a site link: /bible/<book>/<chapter>#v<n> */
export type Ref = { slug: string; chapter: number; verse?: number; verseEnd?: number };

export function parseRef(href: string): Ref | null {
  const m = href.match(/^(?:https?:\/\/[^/]+)?(?:\/cyberjudah)?\/bible\/([a-z0-9-]+)\/(\d+)(?:\/)?(?:#v(\d+)(?:-(\d+))?)?(?:[?#].*)?$/i);
  if (!m) return null;
  const chapter = Number(m[2]);
  if (!Number.isInteger(chapter) || chapter < 1) return null;
  return { slug: m[1].toLowerCase(), chapter, verse: m[3] ? Number(m[3]) : undefined, verseEnd: m[4] ? Number(m[4]) : undefined };
}

/** "97-100, 1,3" -> [97,98,99,100,1,3]; "" -> [] (the whole chapter). */
export function verseNumbers(spec: string | undefined): number[] {
  if (!spec) return [];
  const out: number[] = [];
  for (const part of spec.split(/[,;]\s*/)) {
    const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let n = Math.min(a, b); n <= Math.max(a, b) && n - a < 200; n++) out.push(n);
  }
  return out;
}

/** Fold the concordance (one row per citing passage) into one row per document. */
export function mergeCitations(cited: Citation[]): Citation[] {
  const out: Citation[] = [];
  for (const c of cited) {
    const hit = out.find((x) => x.url === c.url);
    if (!hit) out.push({ ...c, verses: c.verses || "" });
    else if (c.verses) {
      const have = (hit.verses ?? "").split(", ").filter(Boolean);
      if (!have.includes(c.verses)) hit.verses = [...have, c.verses].join(", ");
    }
  }
  return out;
}

/** Which merged citations touch a verse: an explicit range, or a whole-chapter citation. */
export function citationsForVerse(list: Citation[], verse: number): Citation[] {
  return list.filter((c) => !c.verses || verseNumbers(c.verses).includes(verse));
}

/** Verse -> number of citations that name it explicitly. */
export function verseCounts(list: Citation[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const c of list) for (const v of verseNumbers(c.verses)) m.set(v, (m.get(v) ?? 0) + 1);
  return m;
}

export const KIND_LABEL: Record<string, string> = {
  note: "Note", study: "Study", class: "Class", captains: "Episode", encyclopedia: "Encyclopedia",
  law: "Law", precept: "Precept", case: "Case",
};

/** The concordance calls every note "note"; the URL tells which shelf it is on. */
export function shelf(c: Citation): "study" | "class" | "captains" | "encyclopedia" | "law" | "precept" | "case" | "other" {
  if (c.kind === "law" || c.kind === "precept" || c.kind === "case") return c.kind;
  if (c.url.startsWith("/law/")) return "law";
  if (c.url.startsWith("/precepts/")) return "precept";
  if (c.url.startsWith("/cases/")) return "case";
  if (c.url.startsWith("/study/")) return "study";
  if (c.url.startsWith("/classes/")) return "class";
  if (c.url.startsWith("/captains/")) return "captains";
  if (c.url.startsWith("/encyclopedia/")) return "encyclopedia";
  return "other";
}

const chapterCache = new Map<string, Promise<Chapter>>();
export function getChapter(slug: string, chapter: number): Promise<Chapter> {
  const key = `${slug}/${chapter}`;
  let p = chapterCache.get(key);
  if (!p) {
    p = api.chapter(slug, chapter);
    chapterCache.set(key, p);
    p.catch(() => chapterCache.delete(key));
  }
  return p;
}

export function refTitle(ref: Ref, books?: Book[]): string {
  const base = `${bookName(ref.slug, books)} ${ref.chapter}`;
  if (!ref.verse) return base;
  return ref.verseEnd && ref.verseEnd !== ref.verse ? `${base}:${ref.verse}-${ref.verseEnd}` : `${base}:${ref.verse}`;
}

export function refPath(ref: Ref): string {
  return `/bible/${ref.slug}/${ref.chapter}${ref.verse ? `#v${ref.verse}` : ""}`;
}
