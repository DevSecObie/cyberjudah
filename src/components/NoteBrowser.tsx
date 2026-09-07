import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import useBaseUrl, { useBaseUrlUtils } from "@docusaurus/useBaseUrl";
import { useHistory, useLocation } from "@docusaurus/router";
import { filterNotes, notePath } from "../utils/noteFilters";

// The browse page behind both /classes/browse and /captains/browse. The two feeds differ only
// in their copy and their index file, and the facets are the part worth having in one place:
// topic, book and teacher all came in at once and neither page should drift from the other.

export type Note = {
  title: string; url: string; date: string; year: string; thumb: string;
  books: string[];        // the few books prominent enough to print on the card
  allBooks?: string[];    // every book the note opens, for filtering
  topics?: string[];
  teacher?: string;
  estimated?: boolean;
};
type Topic = { slug: string; label: string };
type Sort = "new" | "old" | "az";

const SORTS: [Sort, string][] = [["new", "Newest"], ["old", "Oldest"], ["az", "A–Z"]];
const SORT_KEYS = new Set<string>(SORTS.map(([k]) => k));   // widened: it is tested against raw query strings
// The filters live in the query string. The search page already worked this way; here a
// narrowed list could not be linked to, bookmarked, or backed out of -- the browser's back
// button left the page entirely rather than undoing the last chip.
const listParam = (p: URLSearchParams, k: string) => (p.get(k) ?? "").split(",").map((x) => x.trim()).filter(Boolean);
// Teacher chips are grouped by rank rather than listed flat: the name in frontmatter carries
// its own title ("Captain Noah"), so the rank is the leading word and the bare name is the
// rest. Anything without a recognised title falls into "Other".
const RANKS: [string, string][] = [["Bishop", "Bishops"], ["Deacon", "Deacons"], ["Captain", "Captains"], ["Officer", "Officers"]];
const rankOf = (t: string) => RANKS.find(([r]) => t.startsWith(r + " "))?.[0] ?? "";
const ALL = "";   // the empty option in the book and teacher selects
const TOPICS_SHOWN = 12;   // the rest are behind "more"; forty chips is not a filter bar

// Pagefind, served from static/pagefind and loaded on the first query; the same index the
// search page uses. The browse page queries it with the feed's `kind` filter so a word that
// appears anywhere in a class, not only in its title, finds the class.
type Pf = { options: (o: Record<string, unknown>) => Promise<void>; search: (q: string, o?: Record<string, unknown>) => Promise<{ results: { data: () => Promise<{ url: string }> }[] }> };
let pfPromise: Promise<Pf> | null = null;
const loadPagefind = (base: string) => (pfPromise ??= import(/* webpackIgnore: true */ `${base}pagefind/pagefind.js`).then(async (pf: Pf) => { await pf.options({ baseUrl: base }); return pf; }));

export default function NoteBrowser({ src, kind, title, heading, description, intro, noun }: {
  src: string;            // site-relative path to the browse index, e.g. "/search/classes.json"
  kind: string;           // the Pagefind `kind` filter for this feed: "class" or "captains"
  title: string;          // document title
  heading: string;
  description: string;
  intro: ReactNode;
  noun: [string, string]; // singular, plural, for the result count
}) {
  const history = useHistory();
  const loc = useLocation();
  const params = new URLSearchParams(loc.search);

  const [all, setAll] = useState<Note[] | null>(null);
  const [topicLabels, setTopicLabels] = useState<Topic[]>([]);
  const [allTopics, setAllTopics] = useState(false);
  const [open, setOpen] = useState(true);          // make the existing facets discoverable
  const [loadError, setLoadError] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [searching, setSearching] = useState(false);

  // The URL is the state. Reading straight out of it keeps the two in step without an effect
  // syncing them in both directions, which is where this kind of thing usually goes wrong.
  const q = params.get("q") ?? "";
  const years = listParam(params, "year");
  const topics = listParam(params, "topic");
  const teachers = listParam(params, "teacher");
  const book = params.get("book") ?? ALL;
  const sortRaw = params.get("sort") ?? "new";
  const sort: Sort = (SORT_KEYS.has(sortRaw) ? sortRaw : "new") as Sort;

  const setParams = (next: Record<string, string | string[]>, replace = false) => {
    const p = new URLSearchParams(history.location.search);
    for (const [k, v] of Object.entries(next)) {
      const val = Array.isArray(v) ? v.join(",") : v;
      if (val) p.set(k, val); else p.delete(k);
    }
    // Facet choices can be undone with Back; typing replaces its current history entry.
    const target = `${history.location.pathname}${p.toString() ? "?" + p : ""}`;
    if (replace) history.replace(target); else history.push(target);
  };
  // The box updates on every keystroke; the URL (and the search) follows a beat later, so a
  // fast typist gets one search for "sabbath", not seven.
  const [typed, setTyped] = useState(q);
  useEffect(() => { setTyped(q); }, [q]);
  useEffect(() => {
    if (typed === q) return;
    const t = setTimeout(() => setParams({ q: typed }, true), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed]);
  const setBook = (v: string) => setParams({ book: v });
  const setSort = (v: Sort) => setParams({ sort: v === "new" ? "" : v });
  const setYears = (v: string[]) => setParams({ year: v });
  const setTopics = (v: string[]) => setParams({ topic: v });
  const setTeachers = (v: string[]) => setParams({ teacher: v });
  const indexUrl = useBaseUrl(src);
  const topicsUrl = useBaseUrl("/search/topics.json");
  const withBase = useBaseUrlUtils().withBaseUrl;
  const base = useBaseUrl("/");

  // Full-text matches for the query: the set of note URLs Pagefind finds. null while a
  // search is in flight or before the first one, so the title match stands in meanwhile.
  const [textHits, setTextHits] = useState<{ q: string; urls: Set<string> } | null>(null);
  useEffect(() => {
    const term = q.trim();
    if (!term) { setTextHits(null); setSearching(false); setSearchError(false); return; }
    let live = true;
    setSearching(true);
    setSearchError(false);
    (async () => {
      try {
        const pf = await loadPagefind(base);
        const res = await pf.search(term, { filters: { kind } });
        const urls = new Set<string>();
        for (const r of res.results) {
          const d = await r.data();
          // Pagefind gives the served path (/cyberjudah/classes/2026/x, possibly with .html);
          // the index rows carry the site-relative /classes/2026/x.
          urls.add(notePath(d.url, base));
        }
        if (live) setTextHits({ q: term, urls });
      } catch {
        pfPromise = null; // a transient download failure must not poison future searches
        if (live) { setTextHits({ q: term, urls: new Set() }); setSearchError(true); }
      } finally { if (live) setSearching(false); }
    })();
    return () => { live = false; };
  }, [q, kind, base]);

  useEffect(() => {
    let live = true;
    setAll(null); setLoadError(false);
    fetch(indexUrl).then((r) => { if (!r.ok) throw new Error("Index unavailable"); return r.json(); })
      .then((rows) => { if (!Array.isArray(rows)) throw new Error("Invalid index"); if (live) setAll(rows); })
      .catch(() => { if (live) setLoadError(true); });
    return () => { live = false; };
  }, [indexUrl]);
  // A missing or unreadable label file only costs the pretty names, so it must not blank the page.
  useEffect(() => { fetch(topicsUrl).then((r) => r.json()).then(setTopicLabels).catch(() => setTopicLabels([])); }, [topicsUrl]);

  const labelOf = useMemo(() => {
    const m = new Map(topicLabels.map((t) => [t.slug, t.label]));
    return (slug: string) => m.get(slug) ?? slug;
  }, [topicLabels]);

  const yearCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of all ?? []) m.set(c.year, (m.get(c.year) ?? 0) + 1);
    return [...m].sort((a, b) => b[0].localeCompare(a[0]));
  }, [all]);

  // Only topics that something is actually tagged with, commonest first: an empty facet is
  // worse than no facet.
  const topicCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of all ?? []) for (const t of c.topics ?? []) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1] || labelOf(a[0]).localeCompare(labelOf(b[0])));
  }, [all, labelOf]);

  const bookOptions = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of all ?? []) for (const b of c.allBooks ?? c.books) m.set(b, (m.get(b) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [all]);

  const teacherGroups = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of all ?? []) if (c.teacher) m.set(c.teacher, (m.get(c.teacher) ?? 0) + 1);
    const byRank = new Map<string, [string, number][]>();
    for (const row of m) {
      const r = rankOf(row[0]);
      if (!byRank.has(r)) byRank.set(r, []);
      byRank.get(r)!.push(row);
    }
    const order: [string, string][] = [...RANKS, ["", "Other"]];
    return order.filter(([r]) => byRank.has(r))
      .map(([r, label]) => [label, byRank.get(r)!.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))] as [string, [string, number][]]);
  }, [all]);

  const hits = useMemo(() => {
    if (!all) return [];
    return filterNotes(all, { q, years, topics, book, teachers, sort },
      textHits?.q === q.trim() ? textHits.urls : undefined);
  }, [all, q, years, topics, book, teachers, sort, textHits]);

  const toggle = (xs: string[], set: (v: string[]) => void, x: string) =>
    set(xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
  const clear = () => { setTyped(""); history.push(loc.pathname); };
  const filtered = q.trim() !== "" || years.length > 0 || topics.length > 0 || book !== ALL || teachers.length > 0;
  const activeFilters = years.length + topics.length + (book ? 1 : 0) + teachers.length;
  // Arriving with a filter in the URL opens the panel so the reader can see what is narrowing the list.
  useEffect(() => { if (activeFilters > 0) setOpen(true); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Layout title={title} description={description}>
      <main className="cj-browse">
        <div className="cj-browse-inner">
          <header className="cj-browse-head">
            <h1>{heading}</h1>
            <p>{intro}</p>
          </header>

          <div className="cj-filters">
            <div className="cj-filter-row">
              <input
                className="cj-filter-q"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={`Search the ${noun[1]}: any word, name, or scripture`}
                aria-label={`Search the ${noun[1]}`}
                spellCheck={false}
                autoComplete="off"
                type="search"
              />
              <button type="button" className="cj-filter-toggle" aria-expanded={open} aria-controls="cj-filter-panel" onClick={() => setOpen(!open)}>
                Filters{activeFilters > 0 && <i>{activeFilters}</i>} <span aria-hidden="true">{open ? "\u25B4" : "\u25BE"}</span>
              </button>
              <select className="cj-select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
                {SORTS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </div>

            <div id="cj-filter-panel" className="cj-filter-panel" hidden={!open}>
              {topicCounts.length > 0 && (
                <div className="cj-facet">
                  <span className="cj-facet-label">Topic</span>
                  <div className="cj-chips">
                    {/* A selected topic always stays visible, even past the cut, or clearing it
                        would mean expanding the list again to find it. */}
                    {topicCounts.filter(([t], i) => allTopics || i < TOPICS_SHOWN || topics.includes(t)).map(([t, n]) => (
                      <button key={t} type="button" className="cj-chip" data-on={topics.includes(t) || undefined}
                        aria-pressed={topics.includes(t)} onClick={() => toggle(topics, setTopics, t)}>
                        {labelOf(t)} <i>{n}</i>
                      </button>
                    ))}
                    {topicCounts.length > TOPICS_SHOWN && (
                      <button type="button" className="cj-more" onClick={() => setAllTopics(!allTopics)}>
                        {allTopics ? "fewer" : `${topicCounts.length - TOPICS_SHOWN} more`}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {bookOptions.length > 0 && (
                <div className="cj-facet">
                  <span className="cj-facet-label">Book cited</span>
                  <select className="cj-select" value={book} onChange={(e) => setBook(e.target.value)} aria-label="Filter by book opened">
                    <option value={ALL}>Any book</option>
                    {bookOptions.map(([b, n]) => <option key={b} value={b}>{b} ({n})</option>)}
                  </select>
                </div>
              )}

              {teacherGroups.map(([label, list]) => (
                <div className="cj-facet" key={label}>
                  <span className="cj-facet-label">{label}</span>
                  <div className="cj-chips">
                    {list.map(([t, n]) => (
                      <button key={t} type="button" className="cj-chip" data-on={teachers.includes(t) || undefined}
                        aria-pressed={teachers.includes(t)} onClick={() => toggle(teachers, setTeachers, t)}>
                        {t.replace(/^(Bishop|Deacon|Captain|Officer) /, "")} <i>{n}</i>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {yearCounts.length > 0 && (
                <div className="cj-facet">
                  <span className="cj-facet-label">Year</span>
                  <div className="cj-chips">
                    {yearCounts.map(([y, n]) => (
                      <button key={y} type="button" className="cj-chip" data-on={years.includes(y) || undefined}
                        aria-pressed={years.includes(y)} onClick={() => toggle(years, setYears, y)}>
                        {y} <i>{n}</i>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {loadError && <p role="alert">The class list could not load. <button type="button" onClick={() => window.location.reload()}>Try again</button></p>}
          {searchError && <p role="alert">Full-text search is temporarily unavailable. Showing title and teacher matches only.</p>}
          <p className="cj-count" role="status" aria-live="polite">
            {loadError ? "List unavailable" : all === null ? "Loading…" : searching ? "Searching full notes…" : `${hits.length} ${hits.length === 1 ? noun[0] : noun[1]}`}
            {filtered && all !== null && <> · <button type="button" onClick={clear}>clear</button></>}
          </p>

          <div className="cj-cards">
            {hits.map((c) => (
              <article key={c.url} className="cj-card">
                <Link to={c.url} className="cj-card-thumb" aria-hidden="true" tabIndex={-1}>
                  {c.thumb
                    ? <img src={c.thumb.startsWith("/") ? withBase(c.thumb) : c.thumb} alt="" loading="lazy" width={320} height={180} />
                    : <span className="cj-card-noimg" />}
                </Link>
                <h2><Link to={c.url}>{c.title}</Link></h2>
                <p className="cj-card-meta">
                  <time dateTime={c.date}>{c.date}</time>
                  {c.estimated && <span className="cj-est" title="The recording carries no date; this one is inferred from the class itself">≈</span>}
                  {c.teacher && <> · {c.teacher}</>}
                  {c.books.length > 0 && <> · {c.books.join(" · ")}</>}
                </p>
                {(c.topics ?? []).length > 0 && (
                  <p className="cj-card-topics">
                    {(c.topics ?? []).map((t) => (
                      <button key={t} type="button" className="cj-tag" onClick={() => toggle(topics, setTopics, t)}
                        aria-pressed={topics.includes(t)} data-on={topics.includes(t) || undefined}>
                        {labelOf(t)}
                      </button>
                    ))}
                  </p>
                )}
              </article>
            ))}
          </div>

          {all !== null && !searching && !searchError && hits.length === 0 && (
            <p className="cj-empty">Nothing matches those filters. <button type="button" onClick={clear}>Clear</button> and try again.</p>
          )}
        </div>
      </main>
    </Layout>
  );
}
