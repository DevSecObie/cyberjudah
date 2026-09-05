import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import useBaseUrl, { useBaseUrlUtils } from "@docusaurus/useBaseUrl";

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
// Teacher chips are grouped by rank rather than listed flat: the name in frontmatter carries
// its own title ("Captain Noah"), so the rank is the leading word and the bare name is the
// rest. Anything without a recognised title falls into "Other".
const RANKS: [string, string][] = [["Bishop", "Bishops"], ["Deacon", "Deacons"], ["Captain", "Captains"], ["Officer", "Officers"]];
const rankOf = (t: string) => RANKS.find(([r]) => t.startsWith(r + " "))?.[0] ?? "";
const ALL = "";   // the empty option in the book and teacher selects
const TOPICS_SHOWN = 12;   // the rest are behind "more"; forty chips is not a filter bar

export default function NoteBrowser({ src, title, heading, description, intro, noun }: {
  src: string;            // site-relative path to the browse index, e.g. "/search/classes.json"
  title: string;          // document title
  heading: string;
  description: string;
  intro: ReactNode;
  noun: [string, string]; // singular, plural, for the result count
}) {
  const [all, setAll] = useState<Note[] | null>(null);
  const [topicLabels, setTopicLabels] = useState<Topic[]>([]);
  const [q, setQ] = useState("");
  const [years, setYears] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [book, setBook] = useState(ALL);
  const [teachers, setTeachers] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>("new");
  const [allTopics, setAllTopics] = useState(false);
  const indexUrl = useBaseUrl(src);
  const topicsUrl = useBaseUrl("/search/topics.json");
  const withBase = useBaseUrlUtils().withBaseUrl;

  useEffect(() => { fetch(indexUrl).then((r) => r.json()).then(setAll); }, [indexUrl]);
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
    const lc = q.trim().toLowerCase();
    const out = all.filter((c) => {
      if (years.length && !years.includes(c.year)) return false;
      // Several topics selected means all of them, not any: narrowing is the point.
      if (topics.length && !topics.every((t) => (c.topics ?? []).includes(t))) return false;
      if (book && !(c.allBooks ?? c.books).includes(book)) return false;
      if (teachers.length && !(c.teacher && teachers.includes(c.teacher))) return false;
      if (lc && !c.title.toLowerCase().includes(lc) && !(c.teacher ?? "").toLowerCase().includes(lc)) return false;
      return true;
    });
    return out.sort((a, b) =>
      sort === "az" ? a.title.localeCompare(b.title)
        : sort === "old" ? a.date.localeCompare(b.date) || a.title.localeCompare(b.title)
          : b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
  }, [all, q, years, topics, book, teachers, sort]);

  const toggle = (xs: string[], set: (v: string[]) => void, x: string) =>
    set(xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
  const clear = () => { setQ(""); setYears([]); setTopics([]); setBook(ALL); setTeachers([]); };
  const filtered = q.trim() !== "" || years.length > 0 || topics.length > 0 || book !== ALL || teachers.length > 0;

  return (
    <Layout title={title} description={description}>
      <main className="cj-browse">
        <div className="cj-browse-inner">
          <header className="cj-browse-head">
            <h1>{heading}</h1>
            <p>{intro}</p>
          </header>

          <div className="cj-filters">
            <input
              className="cj-filter-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by name or teacher"
              aria-label="Filter by name or teacher"
              spellCheck={false}
              autoComplete="off"
            />

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
                <span className="cj-facet-label">Book</span>
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

            {yearCounts.length > 1 && (
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

            <div className="cj-facet">
              <span className="cj-facet-label">Sort</span>
              <div className="cj-chips">
                {SORTS.map(([k, label]) => (
                  <button key={k} type="button" className="cj-chip" data-on={sort === k || undefined}
                    aria-pressed={sort === k} onClick={() => setSort(k)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="cj-count">
            {all === null ? "Loading" : `${hits.length} ${hits.length === 1 ? noun[0] : noun[1]}`}
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

          {all !== null && hits.length === 0 && (
            <p className="cj-empty">Nothing matches those filters. <button type="button" onClick={clear}>Clear</button> and try again.</p>
          )}
        </div>
      </main>
    </Layout>
  );
}
