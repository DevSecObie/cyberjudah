import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { fmtDate } from "@/lib/api";
import { haptic, tg } from "@/lib/telegram";
import { toAppPath } from "@/lib/telegram-links.mjs";

/**
 * The building blocks of the Mini App's own screens (routes/app/*): a phone-app layout with a
 * tab bar, grouped lists and big tap targets, in the site's colours. The website's pages stay
 * as they are; a link the app has no screen for opens the website page.
 */

type IconName = "home" | "search" | "play" | "book" | "more" | "chevron" | "back" | "share" | "clock";
export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const p = {
    home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4.2-4.2" /></>,
    play: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m10 9 5 3-5 3z" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" /></>,
    more: <><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></>,
    chevron: <path d="m9 5 7 7-7 7" />,
    back: <path d="m15 5-7 7 7 7" />,
    share: <><path d="M12 3v13" /><path d="m7 8 5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  }[name];
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p}</svg>;
}

const TABS: { to: string; label: string; icon: IconName; match: RegExp }[] = [
  { to: "/app", label: "Home", icon: "home", match: /^\/app\/?$/ },
  { to: "/app/search", label: "Search", icon: "search", match: /^\/app\/search/ },
  { to: "/app/classes", label: "Classes", icon: "play", match: /^\/app\/classes/ },
  { to: "/app/bible", label: "Bible", icon: "book", match: /^\/app\/bible/ },
  { to: "/app/more", label: "More", icon: "more", match: /^\/app\/more/ },
];

/** Tabs switch in place (replace), so Telegram's back button never walks through tab taps. */
export function TabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="app-tabs" aria-label="Sections">
      {TABS.map((t) => {
        const on = t.match.test(pathname);
        return (
          <Link key={t.to} to={t.to as never} replace className="app-tab" aria-current={on ? "page" : undefined}>
            <Icon name={t.icon} size={24} />
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Screen({ title, kicker, children, action }: { title?: ReactNode; kicker?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <main className="app-screen">
      {title ? (
        <header className="app-head">
          <div>
            {kicker ? <p className="app-kicker">{kicker}</p> : null}
            <h1 className="app-title">{title}</h1>
          </div>
          {action}
        </header>
      ) : null}
      {children}
    </main>
  );
}

export function Section({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="app-section">
      {title ? <div className="app-section__head"><h2>{title}</h2>{action}</div> : null}
      {children}
    </section>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="app-seg" role="tablist" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" role="tab" aria-selected={v === value} onClick={() => { if (v !== value) { haptic("select"); onChange(v); } }}>{text}</button>
      ))}
    </div>
  );
}

/** A thumbnail that hides itself when the image cannot load, leaving the placeholder tile. */
export function Img({ src, eager }: { src: string; eager?: boolean }) {
  return <img src={src} alt="" loading={eager ? "eager" : "lazy"} decoding="async" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />;
}

/** A tappable list row. `href` is any site or app path; it opens the app screen when there is one. */
export function Row({ href, onClick, title, sub, meta, thumb, trailing }: { href?: string; onClick?: () => void; title: ReactNode; sub?: ReactNode; meta?: ReactNode; thumb?: string; trailing?: ReactNode }) {
  const go = useGo();
  const inner = (
    <>
      {thumb !== undefined ? <span className="app-row__thumb">{thumb ? <Img src={thumb} /> : null}</span> : null}
      <span className="app-row__body">
        {meta ? <span className="app-row__meta">{meta}</span> : null}
        <span className="app-row__title">{title}</span>
        {sub ? <span className="app-row__sub">{sub}</span> : null}
      </span>
      {trailing ?? <span className="app-row__chev"><Icon name="chevron" size={18} /></span>}
    </>
  );
  if (href) return <a className="app-row" href={toAppPath(href) ?? href} onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); go(href); }}>{inner}</a>;
  return <button type="button" className="app-row" onClick={onClick}>{inner}</button>;
}

/** Navigate to a site or app path, preferring the app's own screen. */
export function useGo() {
  const navigate = useNavigate();
  return (href: string, replace = false) => {
    const app = toAppPath(href);
    void navigate({ href: app ?? href, replace } as never);
  };
}

export function SearchField({ value, onChange, onSubmit, placeholder, autoFocus, id }: { value: string; onChange: (v: string) => void; onSubmit?: () => void; placeholder: string; autoFocus?: boolean; id: string }) {
  return (
    <form className="app-field" role="search" onSubmit={(e) => { e.preventDefault(); (document.activeElement as HTMLElement | null)?.blur(); onSubmit?.(); }}>
      <Icon name="search" size={18} />
      <input id={id} type="search" enterKeyHint="search" autoComplete="off" autoCorrect="off" spellCheck={false} value={value} placeholder={placeholder} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} aria-label={placeholder} />
      {value ? <button type="button" className="app-field__clear" aria-label="Clear" onClick={() => onChange("")}>×</button> : null}
    </form>
  );
}

export function Skeleton({ rows = 6, thumb = false }: { rows?: number; thumb?: boolean }) {
  return (
    <div className="app-list" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="app-row app-row--skel">{thumb ? <span className="app-row__thumb" /> : null}<span className="app-row__body"><span className="skel" style={{ width: "40%" }} /><span className="skel" style={{ width: `${70 + ((i * 13) % 25)}%` }} /></span></div>
      ))}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="app-empty"><p className="app-empty__title">{title}</p>{children ? <div className="app-empty__body">{children}</div> : null}</div>;
}

export const when = (date?: string | null, teacher?: string) => [date ? fmtDate(date) : "", teacher ?? ""].filter(Boolean).join(" · ");

/** Opens a YouTube recording (at a moment) in Telegram's player, or a new tab on the web. */
export function openVideo(video: string, start = 0) {
  const url = `https://www.youtube.com/watch?v=${encodeURIComponent(video)}${start > 0 ? `&t=${Math.floor(start)}s` : ""}`;
  const app = tg();
  if (app) app.openLink(url);
  else window.open(url, "_blank", "noopener");
}

export const timestamp = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
};
