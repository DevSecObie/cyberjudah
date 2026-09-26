/**
 * Where a chapter was taught: rows from the `teaching_refs` table (see
 * scripts/corpus/index.py), grouped by recording for the study panel.
 */
export type TeachingRef = {
  slug?: string;
  chapter?: number;
  first: number;
  last: number | null;
  video: string;
  start: number;
  timing: 'caption' | 'passage';
  title: string;
  feed: string;
  date: string;
  note: string;
  heard: string;
};

export type TaughtMoment = { verses: string; label: string; start: number; timing: 'caption' | 'passage'; heard: string };
export type TaughtRecording = { video: string; title: string; feed: string; date: string; note: string; moments: TaughtMoment[] };

export const FEED_LABEL: Record<string, string> = { classes: 'Sabbath class', captains: '15 Min w/Captains', history: 'Our Hidden History' };

/** Does a reference to first..last touch any of the selected verses? No selection matches all. */
export function touches(ref: Pick<TeachingRef, 'first' | 'last'>, verses: number[]) {
  if (!verses.length) return true;
  const last = ref.last && ref.last >= ref.first ? ref.last : ref.first;
  return verses.some(v => v >= ref.first && v <= last);
}

/**
 * One entry per recording, each with its moments in time order. Recordings that taught the
 * chapter most come first, then the newest; undated recordings sort after dated ones.
 */
export function groupTaught(rows: TeachingRef[], verses: number[] = [], label: (row: TeachingRef, verses: string) => string = (_r, v) => `v${v}`): TaughtRecording[] {
  const byVideo = new Map<string, TaughtRecording>();
  for (const row of rows) {
    if (!touches(row, verses)) continue;
    let rec = byVideo.get(row.video);
    if (!rec) {
      rec = { video: row.video, title: row.title || 'Untitled recording', feed: row.feed, date: row.date || '', note: row.note || '', moments: [] };
      byVideo.set(row.video, rec);
    }
    const range = row.last && row.last > row.first ? `${row.first}-${row.last}` : String(row.first);
    const text = label(row, range);
    const start = Math.max(0, Number(row.start) || 0);
    if (!rec.moments.some(m => m.label === text && Math.abs(m.start - start) < 1)) {
      rec.moments.push({ verses: range, label: text, start, timing: row.timing === 'caption' ? 'caption' : 'passage', heard: row.heard || '' });
    }
  }
  const list = Array.from(byVideo.values());
  for (const rec of list) rec.moments.sort((a, b) => a.start - b.start);
  return list.sort((a, b) =>
    b.moments.length - a.moments.length
    || (b.date ? 1 : 0) - (a.date ? 1 : 0)
    || b.date.localeCompare(a.date)
    || a.title.localeCompare(b.title));
}

export function clock(seconds: number) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

export function watchAt(video: string, start: number) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(video)}&t=${Math.max(0, Math.floor(Number(start) || 0))}s`;
}

/** A passage a library page rests on: a chapter, optionally narrowed to verses. */
export type PassageQuery = { slug: string; chapter: number; first?: number; last?: number; book?: string };

const SMALL = new Set(['of', 'the', 'and']);
/** 'song-of-solomon' -> 'Song of Solomon', '1-kings' -> '1 Kings' (when no name is at hand). */
export function bookName(slug: string) {
  return slug.split('-').map((w, i) => (i && SMALL.has(w)) || /^\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/** "12", "12-15", "1,3-5" -> [first, last] spanning them; "" -> null (the whole chapter). */
export function verseSpan(spec: string | undefined): [number, number] | null {
  const numbers = String(spec ?? '').match(/\d+/g)?.map(Number).filter(n => n > 0) ?? [];
  return numbers.length ? [Math.min(...numbers), Math.max(...numbers)] : null;
}

/** Every /bible/<book>/<chapter>[#v<n>[-<m>]] link in a note's markdown, deduplicated. */
export function passagesInMarkdown(markdown: string): PassageQuery[] {
  const out = new Map<string, PassageQuery>();
  for (const m of markdown.matchAll(/\]\(\/bible\/([a-z0-9-]+)\/(\d+)(?:#v(\d+)(?:-(\d+))?)?\)/g)) {
    const q: PassageQuery = { slug: m[1], chapter: Number(m[2]) };
    if (m[3]) { q.first = Number(m[3]); q.last = Number(m[4] ?? m[3]); }
    out.set(`${q.slug}/${q.chapter}/${q.first ?? ''}-${q.last ?? ''}`, q);
  }
  return [...out.values()];
}

/** A page's resolved references (precepts, cases, laws) as passages, deduplicated. */
export function passagesFromRefs(refs: { slug: string | null; chapter: number; verses?: string; book?: string }[]): PassageQuery[] {
  const out = new Map<string, PassageQuery>();
  for (const r of refs) {
    if (!r.slug || !(r.chapter > 0)) continue;
    const span = verseSpan(r.verses);
    const q: PassageQuery = { slug: r.slug, chapter: r.chapter, book: r.book, ...(span ? { first: span[0], last: span[1] } : {}) };
    out.set(`${q.slug}/${q.chapter}/${q.first ?? ''}-${q.last ?? ''}`, q);
  }
  return [...out.values()];
}
