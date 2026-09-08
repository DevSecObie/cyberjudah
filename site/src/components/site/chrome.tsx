import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { CommandMenu, openCommand } from "@/components/site/command";

const NAV = [
  { to: "/bible", label: "Bible" },
  { to: "/study", label: "4 Chapters a Day" },
  { to: "/classes", label: "Sabbath Classes" },
  { to: "/captains", label: "The Captains" },
  { to: "/cases", label: "Case Studies" },
  { to: "/law", label: "The Law" },
] as const;

export function SiteNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="cj-nav">
      <Link to="/" className="cj-nav__brand" aria-label="CyberJudah home">
        <img src="/assets/brand/cyber-lion.png" alt="" width={34} height={34} />
        <span><span className="bk">[</span> cyberjudah <span className="bk">]</span></span>
      </Link>
      <button type="button" className="cj-nav__toggle" aria-expanded={open} aria-controls="cj-nav-links" onClick={() => setOpen((v) => !v)}>
        {open ? "Close" : "Menu"}
      </button>
      <nav id="cj-nav-links" className="cj-nav__links" data-open={open ? "true" : undefined} aria-label="Sections">
        {NAV.map((n) => (
          <Link key={n.to} to={n.to} className="cj-nav__link" activeProps={{ "data-status": "active" } as never} onClick={() => setOpen(false)}>
            {n.label}
          </Link>
        ))}
        <button type="button" className="cj-nav__search" onClick={() => { setOpen(false); openCommand(); }} aria-label="Search the library (Command K)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4.2-4.2" strokeLinecap="round" /></svg>
          <span>Search</span>
          <kbd aria-hidden="true">⌘K</kbd>
        </button>
      </nav>
      <CommandMenu />
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="cj-footer">
      <div className="cj-wrap cj-footer__grid">
        <div>
          <p className="wordmark"><img src="/assets/brand/icons/icon-4.png" alt="" width={22} height={22} style={{ verticalAlign: "-0.3em", marginRight: "0.5rem" }} /><span className="bk">[</span> cyberjudah <span className="bk">]</span></p>
          <p style={{ margin: 0, maxWidth: "34ch" }}>
            KJV study Bible with the Apocrypha, and everything taught from it, on the same page.
          </p>
          <p className="cj-mono" style={{ marginTop: "1rem" }}>The Bible text is the public-domain King James Version (1769) with Apocrypha.</p>
        </div>
        <div>
          <h4>~/read</h4>
          <ul>
            <li><Link to="/bible">Bible</Link></li>
            <li><Link to="/study">4 Chapters a Day</Link></li>
            <li><Link to="/classes">Sabbath Classes</Link></li>
            <li><Link to="/captains">The Captains</Link></li>
          </ul>
        </div>
        <div>
          <h4>~/law</h4>
          <ul>
            <li><Link to="/cases">Case Studies</Link></li>
            <li><Link to="/law">The Law</Link></li>
            <li><Link to="/precepts">Precepts</Link></li>
            <li><Link to="/concordance">Concordance</Link></li>
            <li><Link to="/classes/by-book">Classes by book</Link></li>
          </ul>
        </div>
        <div>
          <h4>~/bin</h4>
          <ul>
            <li><Link to="/search" search={{ q: "", only: undefined }}>Search</Link></li>
            <li><Link to="/encyclopedia">Encyclopedia</Link></li>
            <li><Link to="/topics">Topics</Link></li>
            <li><Link to="/api">API</Link></li>
            <li><Link to="/downloads">Downloads</Link></li>
            <li><Link to="/about">About</Link></li>
            <li><a href="https://github.com/DevSecObie/cyberjudah">GitHub</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

export function Page({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="cj-shell">
      <SiteNav />
      <main className={wide ? "cj-page" : "cj-wrap cj-page"}>{children}</main>
      <SiteFooter />
    </div>
  );
}

/** Primary CTA: the vermilion block that "lights" from the left on hover. */
export function LampButton({ to, href, children }: { to?: string; href?: string; children: ReactNode }) {
  if (to) return <Link to={to as never} className="lamp-btn">{children}</Link>;
  return <a href={href} className="lamp-btn">{children}</a>;
}

/** Inline underlined link with an arrow; the underline draws on hover. */
export function ReadLink({ to, href, children, ink = false }: { to?: string; href?: string; children: ReactNode; ink?: boolean }) {
  const cls = ink ? "read-link read-link--ink" : "read-link";
  const inner = (
    <>
      <span>{children}</span>
      <span aria-hidden="true">→</span>
    </>
  );
  if (to) return <Link to={to as never} className={cls}>{inner}</Link>;
  return <a href={href} className={cls}>{inner}</a>;
}

export function Kicker({ children, prompt = false }: { children: ReactNode; prompt?: boolean }) {
  return <p className={prompt ? "cj-kicker cj-kicker--prompt" : "cj-kicker"}>{children}</p>;
}
