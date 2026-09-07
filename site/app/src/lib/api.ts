/**
 * The library's content lives on the existing CyberJudah publication, which exposes it as
 * static JSON. This front end reads that JSON; it never renders from a database of its own,
 * so the daily note pipeline keeps feeding both sites from one source.
 */
export const CONTENT_ORIGIN = "https://devsecobie.github.io/cyberjudah";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${CONTENT_ORIGIN}${path}`, { headers: { accept: "application/json" } });
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

/** Thumbnails in the feed are either site-relative to the publication or absolute. */
export const thumbUrl = (t: string) => (t.startsWith("/") ? `${CONTENT_ORIGIN}${t}` : t);

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
