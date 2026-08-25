import React, { useState } from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import { useHistory } from "@docusaurus/router";
import useBaseUrl from "@docusaurus/useBaseUrl";

const tiles: { to: string; title: string; accent: string }[] = [
  { to: "/bible", title: "Bible", accent: "cyan" },
  { to: "/study", title: "4 Chapters a Day", accent: "magenta" },
  { to: "/classes", title: "Sabbath Class Notes", accent: "amber" },
  { to: "/encyclopedia", title: "Encyclopedia", accent: "cyan" },
  { to: "/law", title: "The Law", accent: "magenta" },
  { to: "/precepts", title: "Precepts", accent: "amber" },
  { to: "/cases", title: "Case Studies", accent: "cyan" },
  { to: "/concordance", title: "Concordance", accent: "magenta" },
  { to: "/api", title: "API", accent: "amber" },
  { to: "/downloads", title: "Downloads", accent: "cyan" },
];

export default function Home() {
  const [q, setQ] = useState("");
  const history = useHistory();
  // <Link> prepends baseUrl, history.push does not — without this the form lands off-site
  const searchUrl = useBaseUrl("/search");
  const lionUrl = useBaseUrl("/img/cyber-lion.png");
  return (
    <Layout title="CyberJudah" description="KJV Study Bible with Apocrypha, study notes, class notes, encyclopedia, the law, precepts, and case studies">
      <main className="cj-main">
        <div className="cj-field" aria-hidden="true" />
        <div className="container">
          <header className="cj-hero">
            <div className="cj-term">
              <div className="cj-term-bar" aria-hidden="true">
                <span className="cj-led cj-led--r" />
                <span className="cj-led cj-led--y" />
                <span className="cj-led cj-led--g" />
                <span className="cj-term-path">~/cyberjudah</span>
              </div>
              <div className="cj-term-body">
                <div className="cj-terminal-stage">
                  <div className="cj-brand-lockup" aria-hidden="true">
                    <span className="cj-brand-word cj-brand-word--cyber">Cyber</span>
                    <img className="cj-brand-lion" src={lionUrl} alt="" />
                    <span className="cj-brand-word cj-brand-word--judah">Judah</span>
                  </div>
                  <div className="cj-terminal-copy" aria-hidden="true">
                    <p className="cj-console-line cj-console-line--welcome">
                      <span className="cj-console-user">judah@cyberjudah</span><span className="cj-console-path">:~</span><span className="cj-console-dollar">$</span>
                      <span className="cj-typed">cat welcome.txt</span>
                    </p>
                    <p className="cj-welcome">Shalom, MHNCBU!<span className="cj-caret" /></p>
                    <p className="cj-console-line cj-console-line--live">
                      <span className="cj-console-user">judah@cyberjudah</span><span className="cj-console-path">:~</span><span className="cj-console-dollar">$</span>
                      <span className="cj-live-caret" />
                    </p>
                  </div>
                </div>
              </div>
            </div>
            {/* the visible wordmark is ASCII, so keep a real heading for a11y and search */}
            <h1 className="sr-only">CyberJudah</h1>
            <p className="sr-only">Shalom, MHNCBU!</p>
          </header>

          <form
            className="cj-search"
            onSubmit={(e) => { e.preventDefault(); if (q.trim()) history.push(`${searchUrl}?q=${encodeURIComponent(q.trim())}`); }}
          >
            <span className="cj-prompt" aria-hidden="true">&gt;</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              aria-label="search"
              spellCheck={false}
            />
            <button type="submit">Search</button>
          </form>

          <div className="cj-grid">
            {tiles.map((t) => (
              <Link key={t.to} to={t.to} className="cj-tile" data-accent={t.accent}>
                <span className="cj-name">{t.title}</span>
                <span className="cj-scan" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      </main>
    </Layout>
  );
}
