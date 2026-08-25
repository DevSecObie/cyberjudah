import React, { useState } from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import { useHistory } from "@docusaurus/router";
import stats from "../data/stats.json";

const n = (x: number) => x.toLocaleString();
const cards: { to: string; title: string; meta: string }[] = [
  { to: "/bible", title: "Bible", meta: `${stats.books} books · ${n(stats.chapters)} chapters · ${n(stats.verses)} verses` },
  { to: "/study", title: "Study Notes", meta: `${stats.studies} sessions` },
  { to: "/classes", title: "Class Notes", meta: `${stats.classes} classes` },
  { to: "/encyclopedia", title: "Encyclopedia", meta: `${stats.encyclopedia} topics` },
  { to: "/law", title: "The Law", meta: `${n(stats.laws)} laws · ${stats.sections} sections · ${stats.parts} parts` },
  { to: "/precepts", title: "Precepts", meta: `${stats.precepts} topics` },
  { to: "/cases", title: "Case Studies", meta: `${stats.cases} cases` },
  { to: "/concordance", title: "Concordance", meta: `${n(stats.citedChapters)} chapters cited` },
  { to: "/api", title: "API", meta: "static JSON" },
  { to: "/downloads", title: "Downloads", meta: "markdown, JSON, the vault" },
];
export default function Home() {
  const [q, setQ] = useState(""); const history = useHistory();
  return (
    <Layout title="CyberJudah" description="KJV Study Bible with Apocrypha, study notes, class notes, encyclopedia, the law, precepts, and case studies">
      <main className="container">
        <header className="cj-hero">
          <h1>CyberJudah</h1>
          <p>KJV with Apocrypha · study notes · class notes · encyclopedia · the law · precepts · case studies</p>
        </header>
        <form className="cj-search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) history.push(`/search?q=${encodeURIComponent(q.trim())}`); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search scripture, laws, precepts, cases, and notes" aria-label="search" />
          <button className="button button--primary" type="submit">Search</button>
        </form>
        <div className="cj-grid margin-bottom--xl">
          {cards.map((c) => <Link key={c.to} to={c.to} className="cj-card"><h3>{c.title}</h3><p>{c.meta}</p></Link>)}
        </div>
      </main>
    </Layout>
  );
}
