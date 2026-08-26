import React, { useEffect, useMemo, useState } from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";

type Klass = { title: string; url: string; date: string; year: string; video: string; books: string[] };
type Sort = "new" | "old" | "az";

const SORTS: [Sort, string][] = [["new", "Newest"], ["old", "Oldest"], ["az", "A–Z"]];

export default function Browse() {
  const [all, setAll] = useState<Klass[] | null>(null);
  const [q, setQ] = useState("");
  const [years, setYears] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>("new");
  const src = useBaseUrl("/search/classes.json");

  useEffect(() => { fetch(src).then((r) => r.json()).then(setAll); }, [src]);

  const yearCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of all ?? []) m.set(c.year, (m.get(c.year) ?? 0) + 1);
    return [...m].sort((a, b) => b[0].localeCompare(a[0]));
  }, [all]);

  const hits = useMemo(() => {
    if (!all) return [];
    const lc = q.trim().toLowerCase();
    const out = all.filter((c) => {
      if (years.length && !years.includes(c.year)) return false;
      if (lc && !c.title.toLowerCase().includes(lc)) return false;
      return true;
    });
    return out.sort((a, b) =>
      sort === "az" ? a.title.localeCompare(b.title)
        : sort === "old" ? a.date.localeCompare(b.date) || a.title.localeCompare(b.title)
          : b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
  }, [all, q, years, sort]);

  const toggleYear = (y: string) => setYears(years.includes(y) ? years.filter((x) => x !== y) : [...years, y]);
  const clear = () => { setQ(""); setYears([]); };
  const filtered = q.trim() !== "" || years.length > 0;

  return (
    <Layout title="Class notes" description="Browse the Sabbath class notes by year or name">
      <main className="cj-browse">
        <div className="cj-browse-inner">
          <header className="cj-browse-head">
            <h1>Sabbath class notes</h1>
            <p>Every class written up in full. Find one by name, or narrow to a year.</p>
          </header>

          <div className="cj-filters">
            <input
              className="cj-filter-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by name"
              aria-label="Filter classes by name"
              spellCheck={false}
              autoComplete="off"
            />

            {yearCounts.length > 1 && (
              <div className="cj-facet">
                <span className="cj-facet-label">Year</span>
                <div className="cj-chips">
                  {yearCounts.map(([y, n]) => (
                    <button key={y} type="button" className="cj-chip" data-on={years.includes(y) || undefined}
                      aria-pressed={years.includes(y)} onClick={() => toggleYear(y)}>
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
            {all === null ? "Loading" : `${hits.length} ${hits.length === 1 ? "class" : "classes"}`}
            {filtered && all !== null && <> · <button type="button" onClick={clear}>clear</button></>}
          </p>

          <div className="cj-cards">
            {hits.map((c) => (
              <article key={c.url} className="cj-card">
                <Link to={c.url} className="cj-card-thumb" aria-hidden="true" tabIndex={-1}>
                  {c.video
                    ? <img src={`https://i.ytimg.com/vi/${c.video}/hqdefault.jpg`} alt="" loading="lazy" />
                    : <span className="cj-card-noimg" />}
                </Link>
                <h2><Link to={c.url}>{c.title}</Link></h2>
                <p className="cj-card-meta">
                  <time dateTime={c.date}>{c.date}</time>
                  {c.books.length > 0 && <> · {c.books.join(" · ")}</>}
                </p>
              </article>
            ))}
          </div>

          {all !== null && hits.length === 0 && (
            <p className="cj-empty">No class by that name. <button type="button" onClick={clear}>Clear</button> and try again.</p>
          )}
        </div>
      </main>
    </Layout>
  );
}
