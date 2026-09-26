import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Page } from "@/components/site/chrome";
import { api, type CaseRow } from "@/lib/api";
import { ActiveFilters, Breadcrumbs, eraAnchor } from "@/components/site/browse-tools";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/cases/")({
  validateSearch: (search: Record<string, unknown>): { verdict?: string; view?: "timeline"; q?: string } => ({
    verdict: typeof search.verdict === "string" && Object.hasOwn(VERDICT, search.verdict) ? search.verdict : undefined,
    view: search.view === "timeline" ? "timeline" : undefined,
    q: typeof search.q === "string" && search.q.trim() ? search.q.trim() : undefined,
  }),
  loader: () => api.cases(),
  head: ({ match }) => pageHead([{ title: "Case Studies · CyberJudah" }, { name: "description", content: "Every judgment scripture records, and everyone it records who kept the law and was blessed for it, by era." }], match),
  component: CasesIndex,
});

const VERDICT: Record<string, string> = { death: "Put to death", plague: "Plague", exile: "Exile", captivity: "Captivity", curse: "Cursed", restitution: "Restitution", spared: "Spared", reprieve: "Reprieve", temporal: "Temporal judgment", unrecorded: "Sentence not recorded", deferred: "Sentence deferred", blessed: "Kept the law" };

function Row({ c }: { c: CaseRow }) {
  return (
    <li>
      <Link to={c.url as never}>
        <span>
          <span style={{ display: "block" }}>
            {c.code ? <span className="cj-mono" style={{ color: "var(--color-muted)", marginRight: "0.4rem", fontSize: "0.85em" }}>{c.code}</span> : null}
            {c.name}
          </span>
          <span className="cj-mono" style={{ display: "block", marginTop: "0.15rem", letterSpacing: 0, fontFamily: "inherit", fontSize: "0.92rem" }}>{c.charge}</span>
        </span>
        <span className={`verdict verdict--${c.verdict}`}>{VERDICT[c.verdict] ?? c.verdict}</span>
      </Link>
    </li>
  );
}

function CasesIndex() {
  const data = Route.useLoaderData();
  const { verdict, view, q } = Route.useSearch();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState(q ?? "");

  const filtered = data.cases.filter((c) => {
    if (verdict && c.verdict !== verdict) return false;
    if (q) {
      const needle = q.toLowerCase();
      return c.name.toLowerCase().includes(needle) || c.charge.toLowerCase().includes(needle) || (c.code ?? "").toLowerCase().includes(needle);
    }
    return true;
  });

  const judged = data.cases.filter((c) => c.kind !== "blessing").length;
  const kept = data.cases.length - judged;

  return (
    <Page>
      <Breadcrumbs items={[{ label: "Cases" }]} />
      <h1 className="cj-h1">Case Studies.</h1>
      <p className="cj-lede">{judged} judgments scripture records, and {kept} who kept the law and were blessed for it, by era. Each case carries the offense or the obedience, the sentence or the blessing, the scripture, and the laws it turned on.</p>

      <div className="filters">
        <label htmlFor="case-search">Search</label>
        <input id="case-search" type="search" placeholder="Search by name, charge, or code..." value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            navigate({ to: "/cases", search: { verdict, view, q: e.target.value.trim() || undefined }, resetScroll: false });
          }} style={{ width: "100%", maxWidth: "24rem" }} />
        <label htmlFor="case-judgment">Judgment</label>
        <select id="case-judgment" value={verdict ?? ""} onChange={(event) => navigate({ to: "/cases", search: { verdict: event.target.value || undefined, view, q }, resetScroll: false })}>
          <option value="">All judgments and blessings</option>
          {Object.entries(VERDICT).map(([value, label]) => (
            <option key={value} value={value}>{label} ({data.cases.filter((c) => c.verdict === value).length})</option>
          ))}
        </select>
        <label htmlFor="case-view">View</label>
        <select id="case-view" value={view ?? "list"} onChange={(event) => navigate({ to: "/cases", search: { verdict, view: event.target.value === "timeline" ? "timeline" : undefined, q }, resetScroll: false })}>
          <option value="list">List by era</option><option value="timeline">Era timeline</option>
        </select>
      </div>

      <ActiveFilters items={[
        ...(verdict ? [{ id: "verdict", label: `Judgment: ${VERDICT[verdict]}`, remove: () => navigate({ to: "/cases", search: { view, q }, resetScroll: false }) }] : []),
        ...(q ? [{ id: "search", label: `Search: "${q}"`, remove: () => { setSearchInput(""); navigate({ to: "/cases", search: { verdict, view }, resetScroll: false }); } }] : []),
      ]} onClear={() => { setSearchInput(""); navigate({ to: "/cases", search: { view }, resetScroll: false }); }} />

      <p className="cj-mono" role="status">{filtered.length} of {data.cases.length} cases</p>
      {!filtered.length ? <p>No cases match. Clear the filters to see all cases.</p> : null}
      {view === "timeline" ? <nav aria-label="Case eras">
        <p className="cj-mono">Browse in era order; no exact dates implied.</p>
        <ol className="era-jumps">{data.eras.map((era) => {
          const count = filtered.filter((c) => c.era === era).length;
          return count ? <li key={era}><a href={`#${eraAnchor(era)}`}>{era} ({count})</a></li> : null;
        })}</ol>
      </nav> : null}
      <div className={view === "timeline" ? "case-timeline" : undefined}>
      {data.eras.map((era) => {
        const list = filtered.filter((c) => c.era === era);
        if (!list.length) return null;
        const j = list.filter((c) => c.kind !== "blessing"), b = list.filter((c) => c.kind === "blessing");
        return (
          <section key={era} id={eraAnchor(era)} className="book-block case-era">
            <h2>{era}</h2>
            <ul className="list">{j.map((c) => <Row key={c.slug} c={c} />)}</ul>
            {b.length ? (
              <>
                <p className="cj-kicker" style={{ marginTop: "1.2rem" }}>Kept the law</p>
                <ul className="list">{b.map((c) => <Row key={c.slug} c={c} />)}</ul>
              </>
            ) : null}
          </section>
        );
      })}
      </div>
    </Page>
  );
}
