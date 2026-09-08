import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Page, Kicker } from "@/components/site/chrome";
import { api, fmtDate, nf } from "@/lib/api";

export const Route = createFileRoute("/history/")({
  validateSearch: (s: Record<string, unknown>): { q?: string; year?: string; sort?: "old" | "az" | "ep" } => ({ q: typeof s.q === "string" && s.q.trim() ? s.q.trim().slice(0, 120) : undefined, year: typeof s.year === "string" && s.year ? s.year : undefined, sort: s.sort === "old" || s.sort === "az" || s.sort === "ep" ? (s.sort as "old" | "az" | "ep") : undefined }),
  loader: () => api.history(),
  head: () => ({ meta: [{ title: "Our Hidden History · CyberJudah" }, { name: "description", content: "Our Hidden History Radio: every episode, verbatim, with the recording beside the words." }] }),
  component: HistoryIndex,
});

export const hms = (s: number | null) => { if (!s) return ""; const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`; };

function HistoryIndex() {
  const rows = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [q, setQ] = useState(search.q ?? "");
  const years = useMemo(() => [...new Set(rows.map((r) => r.year).filter(Boolean))].sort().reverse(), [rows]);
  const hits = useMemo(() => {
    const lc = (search.q ?? "").toLowerCase();
    const out = rows.filter((r) => (!search.year || r.year === search.year) && (!lc || r.title.toLowerCase().includes(lc) || (r.episode && `ep ${r.episode}`.includes(lc))));
    if (search.sort === "old") out.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    else if (search.sort === "az") out.sort((a, b) => a.title.localeCompare(b.title));
    else if (search.sort === "ep") out.sort((a, b) => (b.episode ?? 0) - (a.episode ?? 0));
    else out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return out;
  }, [rows, search]);
  const set = (patch: Record<string, string | undefined>) => navigate({ search: (s) => ({ ...s, ...patch }) as never, replace: true, resetScroll: false });
  const hours = Math.round(rows.reduce((a, r) => a + (r.duration ?? 0), 0) / 3600);
  return (
    <Page>
      <Kicker>Our Hidden History Radio</Kicker>
      <h1 className="cj-h1">Our Hidden History.</h1>
      <p className="cj-lede">{rows.length} episodes, {nf.format(hours)} hours, every word as it was spoken, from the moment the show begins. The recording sits beside the transcript; any line seeks the video to that second.</p>
      <div className="browse">
        <div className="browse__row">
          <input value={q} onChange={(e) => { setQ(e.target.value); set({ q: e.target.value || undefined }); }} placeholder="Search titles or an episode number" aria-label="Search" className="browse__q" />
          {years.length > 1 ? <select value={search.year ?? ""} onChange={(e) => set({ year: e.target.value || undefined })} aria-label="Year"><option value="">Any year</option>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select> : null}
          <select value={search.sort ?? "new"} onChange={(e) => set({ sort: e.target.value === "new" ? undefined : e.target.value })} aria-label="Sort"><option value="new">Newest</option><option value="old">Oldest</option><option value="ep">Episode number</option><option value="az">A to Z</option></select>
        </div>
        <p className="browse__count cj-mono" role="status">{hits.length} of {rows.length}</p>
      </div>
      <div className="card-grid">
        {hits.map((r) => (
          <div key={r.slug} className="rail-card rail-card--browse">
            <Link to={r.url as never} className="rail-card__media"><img src={r.thumb} alt="" loading="lazy" width={320} height={180} /></Link>
            <div className="rail-card__body">
              <span className="cj-mono">{r.episode ? `EP ${r.episode} · ` : ""}{r.date ? fmtDate(r.date) : ""}{r.duration ? ` · ${hms(r.duration)}` : ""}</span>
              <h3><Link to={r.url as never}>{r.title}</Link></h3>
              {r.noted ? <span className="cj-mono" style={{ color: "var(--color-amber)" }}>Written up</span> : null}
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}
