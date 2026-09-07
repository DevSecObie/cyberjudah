import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Page, Kicker } from "@/components/site/chrome";
import { api, fmtDate, thumbUrl } from "@/lib/api";

export const Route = createFileRoute("/captains/")({
  loader: () => api.captains(),
  head: () => ({ meta: [{ title: "The Captains · CyberJudah" }, { name: "description", content: "15 Minutes w/ The Captains: short teachings, one subject at a time." }] }),
  component: Browse,
});

function Browse() {
  const all = Route.useLoaderData();
  const [q, setQ] = useState("");
  const [book, setBook] = useState("");
  const [teacher, setTeacher] = useState("");
  const books = useMemo(() => [...new Set(all.flatMap((c) => c.allBooks ?? c.books))].sort(), [all]);
  const teachers = useMemo(() => [...new Set(all.map((c) => c.teacher).filter(Boolean))].sort(), [all]);
  const hits = all.filter((c) => {
    if (book && !(c.allBooks ?? c.books).includes(book)) return false;
    if (teacher && c.teacher !== teacher) return false;
    const lc = q.trim().toLowerCase();
    return !lc || c.title.toLowerCase().includes(lc) || (c.teacher ?? "").toLowerCase().includes(lc);
  });
  return (
    <Page>
      <Kicker>15 Minutes w/ The Captains</Kicker>
      <h1 className="cj-h1">The Captains.</h1>
      <p className="cj-lede">Short teachings from the captains, one subject at a time, every scripture quoted where it was read.</p>
      <div className="filters">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by title or teacher" aria-label="Filter" />
        <select value={book} onChange={(e) => setBook(e.target.value)} aria-label="Book opened"><option value="">Any book</option>{books.map((b) => <option key={b} value={b}>{b}</option>)}</select>
        <select value={teacher} onChange={(e) => setTeacher(e.target.value)} aria-label="Teacher"><option value="">Any teacher</option>{teachers.map((t) => <option key={t} value={t}>{t}</option>)}</select>
        <span className="cj-mono">{hits.length} of {all.length}</span>
      </div>
      <div className="card-grid">
        {hits.map((c) => (
          <Link key={c.url} to={c.url as never} className="rail-card">
            {c.thumb ? <img src={thumbUrl(c.thumb)} alt="" loading="lazy" width={320} height={180} /> : null}
            <div className="rail-card__body">
              <span className="cj-mono">{fmtDate(c.date)}{c.teacher ? ` · ${c.teacher}` : ""}</span>
              <h3>{c.title}</h3>
              {c.books.length ? <span className="cj-mono">{c.books.slice(0, 3).join(" · ")}</span> : null}
            </div>
          </Link>
        ))}
      </div>
    </Page>
  );
}
