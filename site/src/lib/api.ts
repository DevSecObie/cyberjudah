/**
 * The library's content is built by the content engine (engine/ in the DevSecObie/cyberjudah
 * repository) into a framework-independent data set, published to R2 and served by the engine's
 * own Worker at data.cyberjudah.io. This front end reads that data set; it never renders from a
 * database of its own, so the daily note pipeline feeds every front end from one source.
 *
 * A build goes live in one step (pointer.json at the data origin names it), so every file read
 * here comes from the same build.
 */
/** The data set, served by the content engine's own Worker with short cache lifetimes. */
export const DATA_ORIGIN: string = (import.meta.env.VITE_DATA_ORIGIN as string | undefined) || "https://data.cyberjudah.io";
/** This site's own origin; every section of the library is rendered here now. */
export const SITE_ORIGIN = "https://cyberjudah.io";

/** The data root. */
export function dataOrigin(): Promise<string> {
  return Promise.resolve(DATA_ORIGIN);
}
/** The data root, for building URLs synchronously. */
export function dataOriginSync(): string {
  return DATA_ORIGIN;
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
  kind: "study" | "class" | "captains" | "history" | "encyclopedia";
  title: string;
  url: string;
  book?: string;
  chapters?: [number, number];
  range?: string;
  date?: string;
  teacher?: string;
  summary?: string;
};
export type Note = NoteIndexRow & { topics: string[]; videoId: string | null; body: string; collection?: string };
export type FeedRow = {
  title: string;
  url: string;
  date: string;
  year: string;
  teacher: string;
  collection?: string;
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
  history?: number;
  historyHours?: number;
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
export type CaseRow = { slug: string; name: string; era: string; kind: "judgment" | "blessing"; charge: string; verdict: string; url: string; code?: string };
export type CaseIndex = { eras: string[]; verdicts: Record<string, string>; cases: CaseRow[] };
export type StudyEntry = {
  ref: string;
  commentary: string;
  precepts?: { ref: string; text: string }[];
};
export type StudyChapter = {
  chapter: string;
  url: string;
  entries: StudyEntry[];
};
export type TeachingExcerpt = {
  videoId: string;
  title: string;
  date: string | null;
  excerpts: { timestamp: number; time: string; text: string }[];
};
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
  // Enriched fields
  code?: string;
  offenseFull?: string[];
  judgmentFull?: string[];
  alsoCited?: CaseRef[];
  relatedCases?: { slug: string; name: string; desc: string }[];
  studyContent?: StudyChapter[];
  teachingExcerpts?: TeachingExcerpt[];
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
export type LawCaseRef = { slug: string; name: string; charge: string; verdict: string; url: string };
export type LawSection = { id: string; title: string; part: { n: number; title: string; url: string }; url: string; seeAlso: { id: string; title: string; url: string | null }[]; entries: LawEntry[]; caseRefs?: LawCaseRef[] };
export type GlossaryEntry = {
  term: string; slug: string; aliases: string[]; definition: string; url: string;
  scripture: { label: string; url: string }[];
  see: { title: string; url: string }[];
  taught: { title: string; video: string; seconds: number; url: string }[];
};
export type Glossary = { about: string; entries: GlossaryEntry[] };
export type PreceptRow = { slug: string; title: string; refs: number; url: string };
export type Precept = { slug: string; title: string; url: string; refs: ResolvedRef[] };
export type DoctrineRow = { slug: string; name: string; claim: string; refs: number; scriptures: number; books: number; url: string };
export type DoctrineSense = { video: string; ts: string; t: number; teacher: string; text: string; note: string | null };
export type DoctrineClass = Pick<DoctrineSense, "video" | "ts" | "t" | "note"> & { teacher?: string; title: string; date: string };
export type DoctrinePoint = DoctrineClass & ({ read: true; text?: never } | { read?: false; text: string });
export type DoctrineBookQuote = { text: string; highlight: [number, number, number, number][] };
export type DoctrineBookPage = { vol: number; page: number; url: string; classes: number; reads: DoctrineClass[]; scan?: string | null; quotes?: DoctrineBookQuote[] };
export type DoctrineBook = { title: string; author: string; year: number | null; book: string | null; url: string | null } & (
  { pages: DoctrineBookPage[]; said?: never }
  | { pages?: never; said: DoctrineClass & { ref: { label: string; url: string | null }; text: string } }
);
export type DoctrineRelated = { slug: string; url: string; title?: string; name?: string; label?: string };
export type DoctrineEntry = Omit<DoctrineRow, "refs" | "scriptures" | "books"> & {
  answers: { refs: ResolvedRef[]; sense: DoctrineSense[] }[];
  scriptures: (ResolvedRef & { points: DoctrinePoint[] })[];
  books: DoctrineBook[];
  related: { precepts: DoctrineRelated[]; cases: DoctrineRelated[]; topics: DoctrineRelated[] };
};
export type MergedCitation = { kind: string; label: string; url: string; verses: string[] };
export type ConcordanceBookRow = { book: string; slug: string; testament: string; url: string; chapters: number; cited: number[]; citations: number };
export type ConcordanceBook = ConcordanceBookRow & { chapterRows: { chapter: number; url: string; cited_by: MergedCitation[] }[] };
export type EncyclopediaRow = { slug: string; title: string; url: string; summary: string };
export type TopicRow = { slug: string; label: string; notes: number; cases: number; url: string };
export type TopicItem = { kind: "class" | "captains" | "case"; title: string; url: string; date?: string | null; teacher?: string; charge?: string; verdict?: string };
export type Topic = { slug: string; label: string; url: string; items: TopicItem[] };
export type ByBookRow = { book: string; slug: string; testament: string; notes: { url: string; label: string; kind: "class" | "captains"; chapters: number[] }[] };

/** A show or series besides the Sabbath classes (data/shows.json): what it is, its notes, and its transcribed recordings (null where not counted). */
export type ShowRow = { slug: string; name: string; kind: string; url: string; page?: string; feed?: "captains"; match: string[]; notes: number; recordings: number | null };
/** Series that have their own section at the top of the site, by slug: their page, in place of /shows/<slug>. */
export const OWN_SECTION: Record<string, string> = { "giving-the-sense-from-a-to-z": "/giving-the-sense" };

export type HistoryRow = { slug: string; title: string; url: string; episode: number | null; date: string | null; year: string; duration: number | null; videoId: string; thumb: string; teacher: string; topics: string[]; summary: string };

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
  doctrine: () => getJson<DoctrineRow[]>("/api/doctrine/index.json"),
  doctrineEntry: (slug: string) => getJson<DoctrineEntry>(`/api/doctrine/${encodeURIComponent(slug)}.json`),
  concordanceIndex: () => getJson<ConcordanceBookRow[]>("/api/concordance/index.json"),
  concordanceBook: (slug: string) => getJson<ConcordanceBook>(`/api/concordance/${slug}.json`),
  encyclopedia: () => getJson<EncyclopediaRow[]>("/api/encyclopedia/index.json"),
  // Absent until the first glossary is published; an empty glossary rather than an error page.
  glossary: () => getJson<Glossary>("/api/glossary/index.json").catch(() => ({ about: "", entries: [] } as Glossary)),
  topics: () => getJson<TopicRow[]>("/api/topics/index.json"),
  topic: (slug: string) => getJson<Topic>(`/api/topics/${slug}.json`),
  history: () => getJson<HistoryRow[]>("/api/history/index.json"),
  shows: () => getJson<{ shows: ShowRow[] }>("/api/shows/index.json").then((d) => d.shows.map((s) => (OWN_SECTION[s.slug] ? { ...s, url: OWN_SECTION[s.slug] } : s))),
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
