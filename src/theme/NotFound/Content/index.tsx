import React, { useState } from "react";
import Link from "@docusaurus/Link";
import { useHistory, useLocation } from "@docusaurus/router";
import useBaseUrl from "@docusaurus/useBaseUrl";
import type { Props } from "@theme/NotFound/Content";

// Terminal-styled 404. The stock page told visitors to "contact the owner of the
// site"; here a mistyped verse URL gets a prompt, the failing path, and a way out.
export default function NotFoundContent({ className }: Props): React.ReactNode {
  const history = useHistory();
  const location = useLocation();
  const base = useBaseUrl("/");
  const [q, setQ] = useState("");
  const attempted = location.pathname.startsWith(base.replace(/\/$/, ""))
    ? location.pathname.slice(base.replace(/\/$/, "").length) || "/"
    : location.pathname;

  return (
    <main className={className}>
      <div className="cj-404">
        <div className="cj-404-frame">
          <div className="cj-404-bar" aria-hidden="true">
            <span /><span /><span />
            <em>cyberjudah — not found</em>
          </div>
          <div className="cj-404-body">
            <p><b className="cj-404-prompt">cyberjudah:~$</b> open {attempted}</p>
            <p className="cj-404-err">err 404: no such path</p>
            <p className="cj-404-hint">The page may have moved, or the address has a typo. Try one of these:</p>
            <ul className="cj-404-links">
              <li><Link to="/bible">/bible</Link> — the scripture, every chapter</li>
              <li><Link to="/law">/law</Link> — the handbook</li>
              <li><Link to="/classes/browse">/classes</Link> — Sabbath class notes</li>
              <li><Link to="/">/</Link> — start over</li>
            </ul>
            <form
              onSubmit={(e) => { e.preventDefault(); if (q.trim()) history.push(`/search?q=${encodeURIComponent(q.trim())}`); }}
            >
              <label className="cj-404-search">
                <b className="cj-404-prompt">cyberjudah:~$</b>
                <span className="cj-404-cmd">search</span>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="scripture, notes, laws, precepts"
                  aria-label="Search the site"
                  autoFocus
                />
              </label>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
