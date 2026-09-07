/**
 * The library's content is built by the content engine (engine/ in the DevSecObie/cyberjudah
 * repository) into a framework-independent data set on the `data` branch. This front end
 * reads that data set; it never renders from a database of its own, so the daily note
 * pipeline feeds every front end from one source.
 *
 * Addressing: the branch is served content-addressed through jsDelivr, keyed by commit, so
 * every file is immutable and cacheable forever. A tiny pointer (manifest.json on the raw
 * branch, five-minute cache) says which commit is current. Fetching the pointer once per
 * five minutes per Worker isolate keeps everything consistent within a build and fresh
 * across builds.
 */
const REPO = "DevSecObie/cyberjudah";
const POINTER = `https://raw.githubusercontent.com/${REPO}/data/manifest.json`;
const CDN = (ref: string) => `https://cdn.jsdelivr.net/gh/${REPO}@${ref}`;
/** The publication that still renders the sections not yet ported (law, precepts, encyclopedia). */
export const SITE_ORIGIN = "https://devsecobie.github.io/cyberjudah";
/** @deprecated use dataOrigin(); kept for the handful of call sites that build external links. */
export const CONTENT_ORIGIN = SITE_ORIGIN;

let originCache: { origin: string; at: number } | null = null;
let originPending: Promise<string> | null = null;
const POINTER_TTL = 5 * 60 * 1000;

/** The current data root, e.g. https://cdn.jsdelivr.net/gh/DevSecObie/cyberjudah@<commit>. */
export function dataOrigin(): Promise<string> {
  if (originCache && Date.now() - originCache.at < POINTER_TTL) return Promise.resolve(originCache.origin);
  if (originPending) return originPending;
  originPending = (async () => {
    try {
      const res = await fetch(POINTER, { headers: { accept: "application/json" }, cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const m = (await res.json()) as { commit?: string | null };
      const origin = CDN(m.commit && /^[0-9a-f]{40}$/.test(m.commit) ? m.commit : "data");
      originCache = { origin, at: Date.now() };
      return origin;
    } catch {
      // The branch name itself still resolves; it is only cached longer at the edge.
      const origin = originCache?.origin ?? CDN("data");
      originCache = { origin, at: Date.now() - POINTER_TTL + 30_000 };
      return origin;
    } finally {
      originPending = null;
    }
  })();
  return originPending;
}
/** The last resolved data root, for building URLs synchronously after a loader has run. */
export function dataOriginSync(): string {
  return originCache?.origin ?? CDN("data");
}

async function getJson<T>(path: string): Promise<T> {
  const origin = await dataOrigin();
  const res = await fetch(`${origin}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} for ${path}`);
  return (await res.json()) as T;
}

export type Book = {
  book: string;
  slug: string;
  chapters: number;
  verses: number;
  testament: string;
  url: string;
  chapterIds: number[];
};
export type Verse = { verse: number; text: string };
export type Chapter = { book: string; chapter: number; verses: Verse[] };
export type Citation = { kind: string; label: string; url: string; verses?: string };
export type Concordance = { cited_by: Citation[] };
export type NoteIndexRow = {
  kind: "study" | "class" | "captains" | "encyclopedia";
  title: string;
  url: string;
  book?: string;
  chapters?: [number, number];
  range?: string;
  date?: string;
  teacher?: string;
  summary?: string;
};
export type Note = NoteIndexRow & { topics: string[]; videoId: string | null; body: string };
export type FeedRow = {
  title: string;
  url: string;
  date: string;
  year: string;
  teacher: string;
  thumb: string;
  books: string[];
  allBooks?: string[];
  topics?: string[];
  estimated?: boolean;
};
export type Stats = {
  chapters: number;
  books: number;
  verses: number;
  studies: number;
  classes: number;
  captains: number;
  encyclopedia: number;
  laws: number;
  sections: number;
  parts: number;
  precepts: number;
  cases: number;
  blessings: number;
  citedChapters: number;
  recent: { kind: string; title: string; url: string; date: string; teacher: string; thumb: string; books: string[] }[];
};
export type CaseRef = { book: string; chapter: number; verses?: string };
export type CaseRow = { slug: string; name: string; era: string; kind: "judgment" | "blessing"; charge: string; verdict: string; url: string };
export type CaseIndex = { eras: string[]; verdicts: Record<string, string>; cases: CaseRow[] };
export type Case = {
  slug: string;
  name: string;
  era: string;
  kind?: "blessing";
  charge: string;
  verdict: string;
  summary: string;
  offense: string;
  judgment: string;
  refs: CaseRef[];
  laws: string[];
  topics: string[];
  themes: string[];
};

export const api = {
  books: () => getJson<Book[]>("/api/kjv/books.json"),
  chapter: (slug: string, ch: number) => getJson<Chapter>(`/api/kjv/${slug}/${ch}.json`),
  concordance: (slug: string, ch: number) => getJson<Concordance>(`/api/concordance/${slug}/${ch}.json`),
  notes: () => getJson<NoteIndexRow[]>("/api/notes/index.json"),
  note: (sitePath: string) => getJson<Note>(`/api/notes${sitePath}.json`),
  classes: () => getJson<FeedRow[]>("/search/classes.json"),
  captains: () => getJson<FeedRow[]>("/search/captains.json"),
  stats: () => getJson<Stats>("/api/stats.json"),
  cases: () => getJson<CaseIndex>("/api/cases/index.json"),
  case: (slug: string) => getJson<Case>(`/api/cases/${slug}.json`),
};

/** Thumbnails in the feed are either relative to the data set or absolute. */
export const thumbUrl = (t: string) => (t.startsWith("/") ? `${dataOriginSync()}${t}` : t);

/** "genesis" -> "Genesis", "1-samuel" -> "1 Samuel", using the books list when available. */
export function bookName(slug: string, books?: Book[]): string {
  const hit = books?.find((b) => b.slug === slug);
  if (hit) return hit.book;
  return slug.split("-").map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
}

export const nf = new Intl.NumberFormat("en-US");

export function fmtDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  if (!y || !m || !day) return d;
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
