import React, { useState } from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import { useHistory } from "@docusaurus/router";
import stats from "../data/stats.json";

const n = (x: number) => x.toLocaleString();

/** Tiles are a readout, not a blurb: a count and the thing it counts. */
type Tile = { to: string; title: string; value: string; unit: string; accent: string };
const tiles: Tile[] = [
  { to: "/bible", title: "Bible", value: n(stats.verses), unit: "verses", accent: "cyan" },
  { to: "/study", title: "Study Notes", value: n(stats.studies), unit: "sessions", accent: "magenta" },
  { to: "/classes", title: "Class Notes", value: n(stats.classes), unit: "classes", accent: "amber" },
  { to: "/encyclopedia", title: "Encyclopedia", value: n(stats.encyclopedia), unit: "topics", accent: "cyan" },
  { to: "/law", title: "The Law", value: n(stats.laws), unit: "laws", accent: "magenta" },
  { to: "/precepts", title: "Precepts", value: n(stats.precepts), unit: "topics", accent: "amber" },
  { to: "/cases", title: "Case Studies", value: n(stats.cases), unit: "cases", accent: "cyan" },
  { to: "/concordance", title: "Concordance", value: n(stats.citedChapters), unit: "chapters", accent: "magenta" },
  { to: "/api", title: "API", value: "JSON", unit: "static", accent: "amber" },
  { to: "/downloads", title: "Downloads", value: "RAW", unit: "archive", accent: "cyan" },
];

export default function Home() {
  const [q, setQ] = useState("");
  const history = useHistory();
  return (
    <Layout title="CyberJudah" description="KJV Study Bible with Apocrypha, study notes, class notes, encyclopedia, the law, precepts, and case studies">
      <main className="cj-main">
        <div className="cj-field" aria-hidden="true" />
        <div className="container">
          <header className="cj-hero">
            <p className="cj-kicker">
              <span className="cj-dot" />
              KJV + APOCRYPHA <span className="cj-sep">//</span> {stats.books} BOOKS <span className="cj-sep">//</span> {n(stats.chapters)} CHAPTERS INDEXED
            </p>
            <h1 className="cj-title" data-text="CyberJudah">CyberJudah</h1>
            <p className="cj-tagline">Scripture, the law, and the record of judgment — cross-referenced and queryable.</p>
          </header>

          <form
            className="cj-search"
            onSubmit={(e) => { e.preventDefault(); if (q.trim()) history.push(`/search?q=${encodeURIComponent(q.trim())}`); }}
          >
            <span className="cj-prompt" aria-hidden="true">&gt;</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="search scripture, laws, precepts, cases, notes"
              aria-label="search"
              spellCheck={false}
            />
            <button type="submit">RUN</button>
          </form>

          <div className="cj-grid">
            {tiles.map((t, i) => (
              <Link key={t.to} to={t.to} className="cj-tile" data-accent={t.accent}>
                <span className="cj-idx" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <span className="cj-name">{t.title}</span>
                <span className="cj-readout">
                  <span className="cj-val">{t.value}</span>
                  <span className="cj-unit">{t.unit}</span>
                </span>
                <span className="cj-scan" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      </main>
    </Layout>
  );
}
