import { Link, useRouterState } from "@tanstack/react-router";
import { NavigationMenu } from "radix-ui";
import { useState, type ReactNode } from "react";

import { CommandMenu, openCommand } from "@/components/site/command";

type NavItem = { to: string; label: string; blurb: string };
type NavGroup = { label: string; items: NavItem[] };

/**
 * Nine flat links wrapped to two rows on laptops and collapsed to one word on phones. The
 * sections fall into three families, so the nav says so: what is taught, the law, and the
 * reference shelf. The Bible stays a single link because it is the spine of the site.
 */
const GROUPS: NavGroup[] = [
  {
    label: "Teaching",
    items: [
      { to: "/classes", label: "Sabbath Classes", blurb: "Each class written up in full, scriptures cited inline." },
      { to: "/captains", label: "15 Min w/Captains", blurb: "Short teachings, one subject at a time." },
      { to: "/history", label: "Our Hidden History", blurb: "Our Hidden History Radio with Deacon Eythan, verse by verse." },
      { to: "/study", label: "4 Chapters a Day", blurb: "The daily reading, one chapter per page." },
    ],
  },
  {
    label: "Law",
    items: [
      { to: "/law", label: "The Law", blurb: "The handbook of Bible law, every law with its scripture." },
      { to: "/precepts", label: "Precepts", blurb: "Every subject scripture speaks to, A to Z." },
      { to: "/cases", label: "Case Studies", blurb: "The judgments, and those who kept the law and were blessed." },
    ],
  },
  {
    label: "Reference",
    items: [
      { to: "/dictionary", label: "Dictionary", blurb: "What a word or a name means." },
      { to: "/concordance", label: "Concordance", blurb: "For a chapter, everything in the library that cites it." },
      { to: "/encyclopedia", label: "Encyclopedia", blurb: "Standing subjects walked through book by book." },
      { to: "/topics", label: "Topics", blurb: "Find classes and episodes by the topic they carry." },
      { to: "/about", label: "About", blurb: "Where the text and the notes come from." },
    ],
  },
];


function activeGroup(pathname: string): string | null {
  for (const g of GROUPS) if (g.items.some((it) => pathname === it.to || pathname.startsWith(`${it.to}/`))) return g.label;
  return null;
}

function Caret() {
  return <svg className="cj-nav__caret" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (st) => st.location.pathname });
  const current = activeGroup(pathname);
  return (
    <header className="cj-nav">
      <Link to="/" className="cj-nav__brand" aria-label="CyberJudah home">
        <img src="/assets/brand/cyber-lion.png" alt="" width={34} height={34} />
        <span><span className="bk">[</span> cyberjudah <span className="bk">]</span></span>
      </Link>

      <NavigationMenu.Root className="cj-menu" delayDuration={60} skipDelayDuration={300} aria-label="Sections">
        <NavigationMenu.List className="cj-menu__list">
          <NavigationMenu.Item>
            <NavigationMenu.Link asChild>
              <Link to="/bible" className="cj-nav__link" activeProps={{ "data-status": "active" } as never}>Bible</Link>
            </NavigationMenu.Link>
          </NavigationMenu.Item>
          {GROUPS.map((g) => (
            <NavigationMenu.Item key={g.label}>
              <NavigationMenu.Trigger className="cj-nav__link cj-nav__link--trigger" data-status={current === g.label ? "active" : undefined}>
                {g.label}<Caret />
              </NavigationMenu.Trigger>
              <NavigationMenu.Content className="cj-menu__content">
                <ul className="cj-menu__grid">
                  {g.items.map((it) => (
                    <li key={it.to}>
                      <NavigationMenu.Link asChild>
                        <Link to={it.to as never} className="cj-menu__item" activeProps={{ "data-status": "active" } as never}>
                          <b>{it.label}</b>
                          <span>{it.blurb}</span>
                        </Link>
                      </NavigationMenu.Link>
                    </li>
                  ))}
                </ul>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          ))}
        </NavigationMenu.List>
        <div className="cj-menu__viewport-wrap">
          <NavigationMenu.Viewport className="cj-menu__viewport" />
        </div>
      </NavigationMenu.Root>

      <button type="button" className="cj-nav__search" onClick={() => { setOpen(false); openCommand(); }} aria-label="Search the library (Command K)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4.2-4.2" strokeLinecap="round" /></svg>
        <span>Search</span>
        <kbd aria-hidden="true">⌘K</kbd>
      </button>

      <button type="button" className="cj-nav__toggle" aria-expanded={open} aria-controls="cj-nav-links" onClick={() => setOpen((v) => !v)}>
        {open ? "Close" : "Menu"}
      </button>
      <nav id="cj-nav-links" className="cj-nav__links" data-open={open ? "true" : undefined} aria-label="Sections">
        <Link to="/bible" className="cj-nav__link" activeProps={{ "data-status": "active" } as never} onClick={() => setOpen(false)}>Bible</Link>
        {GROUPS.map((g) => (
          <div key={g.label} className="cj-nav__group">
            <p className="cj-nav__group-label">{g.label}</p>
            {g.items.map((it) => (
              <Link key={it.to} to={it.to as never} className="cj-nav__link" activeProps={{ "data-status": "active" } as never} onClick={() => setOpen(false)}>
                {it.label}
              </Link>
            ))}
          </div>
        ))}
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
            <li><Link to="/captains">15 Min w/Captains</Link></li>
            <li><Link to="/history">Our Hidden History</Link></li>
          </ul>
        </div>
        <div>
          <h4>~/law</h4>
          <ul>
            <li><Link to="/cases">Case Studies</Link></li>
            <li><Link to="/law">The Law</Link></li>
            <li><Link to="/precepts">Precepts</Link></li>
            <li><Link to="/concordance">Concordance</Link></li>
          </ul>
        </div>
        <div>
          <h4>~/bin</h4>
          <ul>
            <li><Link to="/search" search={{ q: "", only: undefined }}>Search</Link></li>
            <li><Link to="/encyclopedia">Encyclopedia</Link></li>
            <li><Link to="/dictionary">Dictionary</Link></li>
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
