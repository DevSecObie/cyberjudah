/**
 * The library's content is built by the content engine (engine/ in the DevSecObie/cyberjudah
 * repository) into a framework-independent data set on the `data` branch. This front end
 * reads that data set; it never renders from a database of its own, so the daily note
 * pipeline feeds every front end from one source.
 *
 * Addressing: the branch is served content-addressed through jsDelivr, keyed by commit, so
 * every file is immutable and cacheable forever. A tiny pointer (pointer.json on the raw
 * branch, five-minute cache) says which commit holds the current data set. Fetching the pointer once per
 * five minutes per Worker isolate keeps everything consistent within a build and fresh
 * across builds.
 */
const REPO = "DevSecObie/cyberjudah";
/** The data set, served by the content engine's own Worker with short cache lifetimes. */
export const DATA_ORIGIN: string = (import.meta.env.VITE_DATA_ORIGIN as string | undefined) || "https://data.cyberjudah.io";
/** Fallback: the same data set served content-addressed from the git branch. */
const POINTER = `https://raw.githubusercontent.com/${REPO}/data/pointer.json`;
const CDN = (ref: string) => `https://cdn.jsdelivr.net/gh/${REPO}@${ref}`;
/** This site's own origin; every section of the library is rendered here now. */
export const SITE_ORIGIN = "https://cyberjudah.io";

let originCache: { origin: string; at: number } | null = null;
let originPending: Promise<string> | null = null;
const ORIGIN_TTL = 5 * 60 * 1000;

/** The data root. data.cyberjudah.io when it answers, otherwise the branch through the CDN. */
export function dataOrigin(): Promise<string> {
  if (originCache && Date.now() - originCache.at < ORIGIN_TTL) return Promise.resolve(originCache.origin);
  if (originPending) return originPending;
  originPending = (async () => {
    try {
      const res = await fetch(`${DATA_ORIGIN}/pointer.json`, { headers: { accept: "application/json" }, cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      originCache = { origin: DATA_ORIGIN, at: Date.now() };
      return DATA_ORIGIN;
    } catch {
      try {
        const res = await fetch(POINTER, { headers: { accept: "application/json" }, cache: "no-store" });
        const m = res.ok ? ((await res.json()) as { commit?: string | null }) : {};
        const origin = CDN(m.commit && /^[0-9a-f]{40}$/.test(m.commit) ? m.commit : "data");
        originCache = { origin, at: Date.now() };
        return origin;
      } catch {
        const origin = originCache?.origin ?? CDN("data");
        originCache = { origin, at: Date.now() - ORIGIN_TTL + 30_000 };
        return origin;
      }
    } finally {
      originPending = null;
    }
  })();
  return originPending;
}
/** The last resolved data root, for building URLs synchronously after a loader has run. */
export function dataOriginSync(): string {
  return originCache?.origin ?? DATA_ORIGIN;
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
  verdictLabel?: string;
  related?: { slug: string; name: string; charge: string; url: string }[];
  taught?: { title: string; range: string; url: string }[];
  lawsResolved?: { id: string; text: string; url: string | null }[];
  preceptsResolved?: { slug: string; title: string; url: string | null }[];
  refsResolved?: ResolvedRef[];
  see?: { title: string; url: string }[];
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

/** A scripture reference resolved by the engine: route, study note, and the verses themselves. */
export type ResolvedRef = {
  book: string; chapter: number; verses?: string; key?: boolean;
  slug: string | null; url: string | null; label: string;
  study: { range: string; url: string } | null;
  text: Verse[]; more: number;
};
export type LawSectionRow = { id: string; title: string; laws: number; url: string };
export type LawPart = { n: number; title: string; url: string; sections: LawSectionRow[] };
export type LawEntry = { id: string; text: string; refs: ResolvedRef[]; citation: string };
export type LawSection = { id: string; title: string; part: { n: number; title: string; url: string }; url: string; seeAlso: { id: string; title: string; url: string | null }[]; entries: LawEntry[] };
export type PreceptRow = { slug: string; title: string; refs: number; url: string };
export type Precept = { slug: string; title: string; url: string; refs: ResolvedRef[] };
export type MergedCitation = { kind: string; label: string; url: string; verses: string[] };
export type ConcordanceBookRow = { book: string; slug: string; testament: string; url: string; chapters: number; cited: number[]; citations: number };
export type ConcordanceBook = ConcordanceBookRow & { chapterRows: { chapter: number; url: string; cited_by: MergedCitation[] }[] };
export type EncyclopediaRow = { slug: string; title: string; url: string; summary: string };
export type TopicRow = { slug: string; label: string; notes: number; cases: number; url: string };
export type TopicItem = { kind: "class" | "captains" | "case"; title: string; url: string; date?: string | null; teacher?: string; charge?: string; verdict?: string };
export type Topic = { slug: string; label: string; url: string; items: TopicItem[] };
export type ByBookRow = { book: string; slug: string; testament: string; notes: { url: string; label: string; kind: "class" | "captains"; chapters: number[] }[] };

export const api = {
  books: () => getJson<Book[]>("/api/kjv/books.json"),
  chapter: (slug: string, ch: number) => getJson<Chapter>(`/api/kjv/${slug}/${ch}.json`),
  concordance: (slug: string, ch: number) => getJson<Concordance>(`/api/concordance/${slug}/${ch}.json`),
  notes: () => getJson<NoteIndexRow[]>("/api/notes/index.json"),
  note: (sitePath: string) => getJson<Note>(`/api/notes${sitePath}.json`),
  classes: () => getJson<FeedRow[]>("/search/classes.json").then(absThumbs),
  captains: () => getJson<FeedRow[]>("/search/captains.json").then(absThumbs),
  stats: () => getJson<Stats>("/api/stats.json").then((s) => ({ ...s, recent: absThumbs(s.recent) })),
  cases: () => getJson<CaseIndex>("/api/cases/index.json"),
  case: (slug: string) => getJson<Case>(`/api/cases/${slug}.json`),
  laws: () => getJson<LawPart[]>("/api/laws/index.json"),
  law: (id: string) => getJson<LawSection>(`/api/laws/${id.toUpperCase()}.json`),
  precepts: () => getJson<PreceptRow[]>("/api/precepts/index.json"),
  precept: (slug: string) => getJson<Precept>(`/api/precepts/${slug}.json`),
  concordanceIndex: () => getJson<ConcordanceBookRow[]>("/api/concordance/index.json"),
  concordanceBook: (slug: string) => getJson<ConcordanceBook>(`/api/concordance/${slug}.json`),
  encyclopedia: () => getJson<EncyclopediaRow[]>("/api/encyclopedia/index.json"),
  topics: () => getJson<TopicRow[]>("/api/topics/index.json"),
  topic: (slug: string) => getJson<Topic>(`/api/topics/${slug}.json`),
  topicLabels: () => getJson<{ slug: string; label: string }[]>("/search/topics.json"),
};

/** Thumbnails in the feed are either relative to the data set or absolute. Loaders make them
 *  absolute before render, so the server and the client agree on the same URL. */
export const thumbUrl = (t: string) => (t.startsWith("/") ? `${dataOriginSync()}${t}` : t);
function absThumbs<T extends { thumb: string }>(rows: T[]): T[] {
  return rows.map((r) => (r.thumb && r.thumb.startsWith("/") ? { ...r, thumb: thumbUrl(r.thumb) } : r));
}

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
