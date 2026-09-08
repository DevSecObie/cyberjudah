import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { fmtDate, thumbUrl, type FeedRow } from "@/lib/api";

/**
 * The class and episode browser. Topic chips first (that is how people look for a class),
 * then a title search, a topic dropdown, the teacher and the year. (Book filtering is
 * kept in the URL contract but not shown for now.) Every choice lives in the
 * URL, so a filtered view can be shared and Back undoes a chip.
 */
export type BrowseSearch = { q?: string; topic?: string; book?: string; teacher?: string; year?: string; sort?: "new" | "old" | "az" };

export function validateBrowse(s: Record<string, unknown>): BrowseSearch {
  const str = (k: string) => (typeof s[k] === "string" && (s[k] as string).trim() ? (s[k] as string).trim().slice(0, 120) : undefined);
  const sort = s.sort === "old" || s.sort === "az" ? s.sort : undefined;
  return { q: str("q"), topic: str("topic"), book: str("book"), teacher: str("teacher"), year: str("year"), sort };
}

const TOP = 14;

export function NoteBrowser({ rows, topics, search, route }: { rows: FeedRow[]; topics: { slug: string; label: string }[]; search: BrowseSearch; route: "/classes" | "/captains" }) {
  const navigate = useNavigate();
  const [q, setQ] = useState(search.q ?? "");
  const [moreTopics, setMoreTopics] = useState(false);
  useEffect(() => { setQ(search.q ?? ""); }, [search.q]);
  const set = (patch: Partial<BrowseSearch>, replace = false) =>
    navigate({ to: route as never, search: clean({ ...search, ...patch }) as never, replace, resetScroll: false });
  useEffect(() => {
    const t = window.setTimeout(() => { if ((q || undefined) !== search.q) set({ q: q || undefined }, true); }, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const label = useMemo(() => new Map(topics.map((t) => [t.slug, t.label])), [topics]);
  const picked = search.topic ? search.topic.split(",").filter(Boolean) : [];

  const hits = useMemo(() => {
    const lc = (search.q ?? "").toLowerCase();
    const out = rows.filter((r) => {
      if (picked.length && !picked.every((t) => (r.topics ?? []).includes(t))) return false;
      if (search.book && !(r.allBooks ?? r.books).includes(search.book)) return false;
      if (search.teacher && (r.teacher || "Not recorded") !== search.teacher) return false;
      if (search.year && r.year !== search.year) return false;
      return !lc || r.title.toLowerCase().includes(lc) || (r.teacher ?? "").toLowerCase().includes(lc) || (r.topics ?? []).some((t) => (label.get(t) ?? t).toLowerCase().includes(lc));
    });
    if (search.sort === "old") out.sort((a, b) => a.date.localeCompare(b.date));
    else if (search.sort === "az") out.sort((a, b) => a.title.localeCompare(b.title));
    else out.sort((a, b) => b.date.localeCompare(a.date));
    return out;
  }, [rows, search, picked.join(","), label]);

  // Facets count within the current result so a chip never leads to an empty page.
  const topicCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of hits) for (const t of r.topics ?? []) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || (label.get(a[0]) ?? a[0]).localeCompare(label.get(b[0]) ?? b[0]));
  }, [hits, label]);
  const shownTopics = moreTopics ? topicCounts : topicCounts.filter(([t], i) => i < TOP || picked.includes(t));
  // Every topic across the whole feed, for the dropdown (the chips count within the result).
  const allTopics = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) for (const t of r.topics ?? []) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => (label.get(a[0]) ?? a[0]).localeCompare(label.get(b[0]) ?? b[0]));
  }, [rows, label]);
  const teachers = useMemo(() => [...new Set(rows.map((r) => r.teacher || "Not recorded"))].sort(), [rows]);
  const years = useMemo(() => [...new Set(rows.map((r) => r.year).filter(Boolean))].sort().reverse(), [rows]);
  const active = [search.q, search.book, search.teacher, search.year, ...picked].filter(Boolean).length;

  const toggleTopic = (t: string) => set({ topic: (picked.includes(t) ? picked.filter((x) => x !== t) : [...picked, t]).join(",") || undefined });

  return (
    <>
      <div className="browse">
        <div className="browse__row">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles, teachers and topics" aria-label="Search" className="browse__q" />
          <select value={picked.length === 1 ? picked[0] : ""} onChange={(e) => set({ topic: e.target.value || undefined })} aria-label="Topic"><option value="">{picked.length > 1 ? `${picked.length} topics` : "Any topic"}</option>{allTopics.map(([t, n]) => <option key={t} value={t}>{label.get(t) ?? t} ({n})</option>)}</select>
          <select value={search.teacher ?? ""} onChange={(e) => set({ teacher: e.target.value || undefined })} aria-label="Teacher"><option value="">Any teacher</option>{teachers.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          {years.length > 1 ? <select value={search.year ?? ""} onChange={(e) => set({ year: e.target.value || undefined })} aria-label="Year"><option value="">Any year</option>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select> : null}
          <select value={search.sort ?? "new"} onChange={(e) => set({ sort: e.target.value === "new" ? undefined : (e.target.value as "old" | "az") })} aria-label="Sort"><option value="new">Newest</option><option value="old">Oldest</option><option value="az">A to Z</option></select>
        </div>
        {topicCounts.length ? (
          <div className="browse__topics" role="group" aria-label="Topics">
            {shownTopics.map(([t, n]) => (
              <button key={t} type="button" className={picked.includes(t) ? "chip chip--active" : "chip"} aria-pressed={picked.includes(t)} onClick={() => toggleTopic(t)}>
                {label.get(t) ?? t} <span className="chip__n">{n}</span>
              </button>
            ))}
            {topicCounts.length > TOP ? <button type="button" className="chip chip--ghost" onClick={() => setMoreTopics((v) => !v)}>{moreTopics ? "Fewer topics" : `${topicCounts.length - Math.min(TOP, topicCounts.length)} more topics`}</button> : null}
          </div>
        ) : null}
        <p className="browse__count cj-mono" role="status">
          {hits.length} of {rows.length}
          {active ? <> · <button type="button" className="browse__clear" onClick={() => { setQ(""); navigate({ to: route as never, search: {} as never, resetScroll: false }); }}>clear</button></> : null}
        </p>
      </div>
      {hits.length === 0 ? <p className="cj-lede">Nothing matches. Clear a filter or try another word.</p> : null}
      <div className="card-grid">
        {hits.map((c) => (
          <div key={c.url} className="rail-card rail-card--browse">
            <Link to={c.url as never} className="rail-card__media">
              {c.thumb ? <img src={thumbUrl(c.thumb)} alt="" loading="lazy" width={320} height={180} /> : null}
            </Link>
            <div className="rail-card__body">
              <span className="cj-mono">{fmtDate(c.date)}{c.estimated ? " ≈" : ""}{c.teacher ? ` · ${c.teacher}` : ""}</span>
              <h3><Link to={c.url as never}>{c.title}</Link></h3>
              {c.topics?.length ? (
                <p className="rail-card__tags">
                  {c.topics.slice(0, 4).map((t) => <button key={t} type="button" className={picked.includes(t) ? "tag tag--active" : "tag"} onClick={() => toggleTopic(t)}>{label.get(t) ?? t}</button>)}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function clean(s: BrowseSearch): BrowseSearch {
  const out: BrowseSearch = {};
  for (const [k, v] of Object.entries(s)) if (v) (out as Record<string, unknown>)[k] = v;
  return out;
}
