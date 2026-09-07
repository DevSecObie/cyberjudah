import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

const NAV = [
  { to: "/bible", label: "Bible" },
  { to: "/study", label: "4 Chapters a Day" },
  { to: "/classes", label: "Sabbath Classes" },
  { to: "/captains", label: "The Captains" },
  { to: "/cases", label: "Case Studies" },
  { to: "/search", label: "Search" },
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
      </nav>
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
            <li><a href="https://devsecobie.github.io/cyberjudah/law">Handbook</a></li>
            <li><a href="https://devsecobie.github.io/cyberjudah/precepts">Precepts</a></li>
            <li><a href="https://devsecobie.github.io/cyberjudah/concordance">Concordance</a></li>
          </ul>
        </div>
        <div>
          <h4>~/bin</h4>
          <ul>
            <li><Link to="/search" search={{ q: "" }}>Search</Link></li>
            <li><a href="https://devsecobie.github.io/cyberjudah/api">API</a></li>
            <li><a href="https://devsecobie.github.io/cyberjudah/encyclopedia">Encyclopedia</a></li>
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

export function Kicker({ children }: { children: ReactNode }) {
  return <p className="cj-kicker">{children}</p>;
}
