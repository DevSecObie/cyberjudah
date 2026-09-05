import React, { useEffect, useMemo, useState } from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import useBaseUrl, { useBaseUrlUtils } from "@docusaurus/useBaseUrl";

type Klass = { title: string; url: string; date: string; year: string; thumb: string; books: string[]; teacher?: string };
type Sort = "new" | "old" | "az";

// Teacher chips are grouped by rank rather than listed flat: the name in frontmatter
// carries its own title ("Captain Noah"), so the rank is the leading word and the bare
// name is the rest. Anything without a recognised title falls into "Other".
const RANKS: [string, string][] = [["Bishop", "Bishops"], ["Deacon", "Deacons"], ["Captain", "Captains"], ["Officer", "Officers"]];
const rankOf = (t: string) => RANKS.find(([r]) => t.startsWith(r + " "))?.[0] ?? "";

const SORTS: [Sort, string][] = [["new", "Newest"], ["old", "Oldest"], ["az", "A–Z"]];

export default function Browse() {
  const [all, setAll] = useState<Klass[] | null>(null);
  const [q, setQ] = useState("");
  const [years, setYears] = useState<string[]>([]);
  const [teachers, setTeachers] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>("new");
  const src = useBaseUrl("/search/classes.json");
  const withBase = useBaseUrlUtils().withBaseUrl;

  useEffect(() => { fetch(src).then((r) => r.json()).then(setAll); }, [src]);

  const yearCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of all ?? []) m.set(c.year, (m.get(c.year) ?? 0) + 1);
    return [...m].sort((a, b) => b[0].localeCompare(a[0]));
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
    const order = [...RANKS.map(([r, label]) => [r, label] as [string, string]), ["", "Other"] as [string, string]];
    return order
      .filter(([r]) => byRank.has(r))
      .map(([r, label]) => [label, byRank.get(r)!.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))] as [string, [string, number][]]);
  }, [all]);

  const hits = useMemo(() => {
    if (!all) return [];
    const lc = q.trim().toLowerCase();
    const out = all.filter((c) => {
      if (years.length && !years.includes(c.year)) return false;
      if (teachers.length && !(c.teacher && teachers.includes(c.teacher))) return false;
      if (lc && !c.title.toLowerCase().includes(lc)) return false;
      return true;
    });
    return out.sort((a, b) =>
      sort === "az" ? a.title.localeCompare(b.title)
        : sort === "old" ? a.date.localeCompare(b.date) || a.title.localeCompare(b.title)
          : b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
  }, [all, q, years, teachers, sort]);

  const toggleYear = (y: string) => setYears(years.includes(y) ? years.filter((x) => x !== y) : [...years, y]);
  const toggleTeacher = (t: string) => setTeachers(teachers.includes(t) ? teachers.filter((x) => x !== t) : [...teachers, t]);
  const clear = () => { setQ(""); setYears([]); setTeachers([]); };
  const filtered = q.trim() !== "" || years.length > 0 || teachers.length > 0;

  return (
    <Layout title="Class notes" description="Browse the Sabbath class notes by year or name">
      <main className="cj-browse">
        <div className="cj-browse-inner">
          <header className="cj-browse-head">
            <h1>Sabbath class notes</h1>
            <p>
              Every class written up in full. Find one by name, or narrow to a year or teacher.
              {" "}<Link to="/classes">Read them as a feed</Link> instead.
            </p>
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

            {teacherGroups.length > 0 && teacherGroups.map(([label, list]) => (
              <div className="cj-facet" key={label}>
                <span className="cj-facet-label">{label}</span>
                <div className="cj-chips">
                  {list.map(([t, n]) => (
                    <button key={t} type="button" className="cj-chip" data-on={teachers.includes(t) || undefined}
                      aria-pressed={teachers.includes(t)} onClick={() => toggleTeacher(t)}>
                      {t.replace(/^(Bishop|Deacon|Captain|Officer) /, "")} <i>{n}</i>
                    </button>
                  ))}
                </div>
              </div>
            ))}

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
                  {c.thumb
                    ? <img src={c.thumb.startsWith("/") ? withBase(c.thumb) : c.thumb} alt="" loading="lazy" width={320} height={180} />
                    : <span className="cj-card-noimg" />}
                </Link>
                <h2><Link to={c.url}>{c.title}</Link></h2>
                <p className="cj-card-meta">
                  <time dateTime={c.date}>{c.date}</time>
                  {c.teacher && <> · {c.teacher}</>}
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
