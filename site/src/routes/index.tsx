import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { ScrollScrub } from "@/components/scroll-scrub/scroll-scrub";
import { buildScrollScrubScenes, scrollScrubTheme } from "@/scroll-scrub-scenes";
import { SiteNav, SiteFooter, LampButton, ReadLink, Kicker } from "@/components/site/chrome";
import { Motion } from "@/components/site/motion";
import { Matrix } from "@/components/site/matrix";
import { GlowGrid, CountUp, Typed } from "@/components/site/cyber";
import { api, fmtDate, nf, thumbUrl, type Stats } from "@/lib/api";
import { openCommand } from "@/components/site/command";
import { PASSAGES, passageOfTheDay } from "@/lib/passages";
import { prefs, useTelegramButtons } from "@/lib/telegram";

/** Inside Telegram: pick up where the reader left off, and search, from the bottom bar. */
function useTelegramFrontDoor() {
  const navigate = useNavigate();
  const [last, setLast] = useState<{ slug: string; chapter: number; name: string } | null>(null);
  useEffect(() => {
    prefs.get("last-read", (v) => {
      try {
        const p = v ? JSON.parse(v) : null;
        if (p && typeof p.slug === "string" && Number.isInteger(p.chapter) && typeof p.name === "string") setLast(p);
      } catch { /* ignore */ }
    });
  }, []);
  useTelegramButtons(
    last ? { text: `Continue · ${last.name}`, onClick: () => navigate({ to: "/bible/$book/$chapter", params: { book: last.slug, chapter: String(last.chapter) } }) }
      : { text: "Open the Bible", onClick: () => navigate({ to: "/bible" }) },
    { text: "Search", onClick: () => openCommand() },
  );
}

function LionFilm() {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const abort = new AbortController();
    let objectUrl: string | undefined;
    // A blob keeps seeking reliable on hosts that do not serve MP4 byte ranges.
    void fetch("/assets/previews/reference-lion.mp4", { signal: abort.signal })
      .then(response => {
        if (!response.ok) throw new Error("Lion video unavailable");
        return response.blob();
      })
      .then(blob => {
        if (abort.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        video.src = objectUrl;
        video.load();
      })
      .catch(() => { /* Leave the stage background visible if media cannot load. */ });
    let frame = 0;
    const update = () => {
      frame = 0;
      video.pause();
      if (!Number.isFinite(video.duration) || video.seeking) return;
      const section = video.closest<HTMLElement>(".scroll-scrub");
      if (!section) return;
      const bounds = section.getBoundingClientRect();
      const distance = Math.max(1, section.offsetHeight - window.innerHeight);
      const progress = reduced.matches ? 0 : Math.max(0, Math.min(1, -bounds.top / distance));
      const target = progress * Math.max(0, video.duration - 0.04);
      if (Math.abs(video.currentTime - target) > 0.025) video.currentTime = target;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    video.addEventListener("loadedmetadata", schedule);
    video.addEventListener("seeked", schedule);
    reduced.addEventListener("change", schedule);
    schedule();
    return () => {
      abort.abort();
      video.removeAttribute("src");
      video.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      video.removeEventListener("loadedmetadata", schedule);
      video.removeEventListener("seeked", schedule);
      reduced.removeEventListener("change", schedule);
    };
  }, []);
  return <video ref={videoRef} className="lion-film" muted playsInline preload="metadata" aria-hidden="true" />;
}

export const Route = createFileRoute("/")({
  loader: async () => {
    try {
      return { stats: await api.stats() };
    } catch {
      return { stats: null as Stats | null };
    }
  },
  component: Index,
});

function Console() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const go = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) navigate({ to: "/search", search: { q: q.trim() } as never });
  };
  const examples = ["Passover", "usury", "Melchizedek", "Ezekiel 37", "\"seventh day\""];
  return (
    <section className="console" aria-label="Search">
      <Matrix />
      <div className="cj-wrap">
        <div className="console__panel" data-reveal>
          <p className="cj-kicker">Search</p>
          <h2 className="cj-h2">The whole library, one query.</h2>
          <p className="cj-lede">Every verse, every class, every law and case. A word, a phrase in quotes, or a reference like John 3:16. Anywhere on the site, press <kbd className="kbd">⌘K</kbd>.</p>
          <form className="search-form" role="search" onSubmit={go}>
            <span className="prompt" aria-hidden="true">~/cyberjudah<b>$</b></span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="grep scripture, notes, laws, cases" aria-label="Search the library" spellCheck={false} autoComplete="off" />
            <button type="submit" className="search-go" aria-label="Search">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4.2-4.2" strokeLinecap="round" /></svg>
            </button>
          </form>
          <ul className="search-eg">
            {examples.map((eg) => (
              <li key={eg}><Link to="/search" search={{ q: eg, only: undefined }} className="read-link"><span>{eg}</span><span aria-hidden="true">→</span></Link></li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Hud({ stats }: { stats: Stats }) {
  return (
    <section className="cj-wrap" style={{ padding: "clamp(2rem, 6vh, 4rem) 0 0" }} data-reveal>
      <div className="hud" role="list" aria-label="Library size">
        <div role="listitem"><b><CountUp value={stats.verses} /></b><span>verses, KJV + Apocrypha</span></div>
        <div role="listitem"><b><CountUp value={stats.classes + stats.captains + stats.studies} /></b><span>notes written up</span></div>
        <div role="listitem"><b><CountUp value={stats.laws} /></b><span>laws in the handbook</span></div>
        <div role="listitem"><b><CountUp value={stats.cases} /></b><span>case studies</span></div>
      </div>
    </section>
  );
}

function NewThisWeek({ stats }: { stats: Stats }) {
  if (!stats.recent?.length) return null;
  return (
    <section style={{ padding: "clamp(3rem, 8vh, 6rem) 0" }}>
      <div className="cj-wrap" data-reveal>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <Kicker>New this week</Kicker>
            <h2 className="cj-h2">What was taught.</h2>
          </div>
          <div style={{ display: "flex", gap: "1.5rem" }}>
            <ReadLink to="/classes">All classes</ReadLink>
            <ReadLink to="/captains">All episodes</ReadLink>
          </div>
        </div>
        <div className="rail" role="list">
          {stats.recent.map((n) => (
            <div role="listitem" key={n.url}>
              <Link to={n.url as never} className="rail-card">
                {n.thumb ? <img src={thumbUrl(n.thumb)} alt="" loading="lazy" width={320} height={180} /> : null}
                <div className="rail-card__body">
                  <span className="cj-mono">{n.kind === "captains" ? "The Captains" : "Sabbath class"} · {fmtDate(n.date)}</span>
                  <h3>{n.title}</h3>
                  <span className="cj-mono">{[n.teacher, n.books?.slice(0, 2).join(" · ")].filter(Boolean).join("  ·  ")}</span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Library({ stats }: { stats: Stats | null }) {
  const s = stats;
  return (
    <section className="cj-wrap" style={{ padding: "0 0 clamp(3rem, 8vh, 6rem)" }} data-reveal>
      <Kicker>The library</Kicker>
      <h2 className="cj-h2">The library.</h2>
      <GlowGrid>
        <div className="bento__cell bento__cell--a">
          <img className="bento__icon" src="/assets/brand/icons/icon-0.png" alt="" width={28} height={28} loading="lazy" />
          <span className="bento__count">{s ? `${s.books} books · ${nf.format(s.verses)} verses` : "King James with the Apocrypha"}</span>
          <span className="bento__title">The Bible</span>
          <p className="bento__blurb">Every chapter on its own page, every verse on its own anchor, with what cites it beside it.</p>
          <span style={{ marginTop: "1.1rem", display: "flex", gap: "1.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <LampButton to="/bible">Open the Bible</LampButton>
            <ReadLink to="/bible/genesis/1">Genesis 1</ReadLink>
          </span>
        </div>
        <Link to="/classes" className="bento__cell bento__cell--b bento__cell--plate" style={{ backgroundImage: "url(/assets/plates/circuit.jpg)" }}>
          <span className="plate-shade" aria-hidden="true" />
          <img className="bento__icon" src="/assets/brand/icons/icon-7.png" alt="" width={28} height={28} loading="lazy" />
          <span className="bento__count">{s ? `${nf.format(s.classes)} classes` : "Sabbath classes"}</span>
          <span className="bento__title">Sabbath Classes</span>
          <p className="bento__blurb">Each class written up in full, scriptures cited inline.</p>
        </Link>
        <Link to="/study" className="bento__cell" style={{ gridColumn: "span 2" }}>
          <img className="bento__icon" src="/assets/brand/icons/icon-6.png" alt="" width={28} height={28} loading="lazy" />
          <span className="bento__count">{s ? `${nf.format(s.studies)} chapters` : "The daily reading"}</span>
          <span className="bento__title">4 Chapters a Day</span>
          <p className="bento__blurb">The daily reading, one chapter per page, every verse taught quoted in place.</p>
        </Link>
        <Link to="/captains" className="bento__cell" style={{ gridColumn: "span 2" }}>
          <img className="bento__icon" src="/assets/brand/icons/icon-1.png" alt="" width={28} height={28} loading="lazy" />
          <span className="bento__count">{s ? `${nf.format(s.captains)} episodes` : "Short teachings"}</span>
          <span className="bento__title">15 Min w/Captains</span>
          <p className="bento__blurb">15 Minutes w/ The Captains: one subject at a time.</p>
        </Link>
        <Link to="/cases" className="bento__cell" style={{ gridColumn: "span 2" }}>
          <img className="bento__icon" src="/assets/brand/icons/icon-3.png" alt="" width={28} height={28} loading="lazy" />
          <span className="bento__count">{s ? `${nf.format(s.cases)} judgments · ${nf.format(s.blessings)} kept the law` : "Judgments and blessings"}</span>
          <span className="bento__title">Case Studies</span>
          <p className="bento__blurb">The judgments, and those who kept the law and were blessed.</p>
        </Link>
        <Link to="/history" className="bento__cell" style={{ gridColumn: "span 6" }}>
          <img className="bento__icon" src="/assets/brand/icons/icon-0.png" alt="" width={28} height={28} loading="lazy" />
          <span className="bento__count">{s?.history ? `${nf.format(s.history)} ${s.history === 1 ? "episode" : "episodes"} written up · ${nf.format(s.historyHours ?? 0)} hours` : "Radio, written up"}</span>
          <span className="bento__title">Our Hidden History</span>
          <p className="bento__blurb">Our Hidden History Radio with Deacon Eythan: the books read on air, the scriptures opened, and the commentary, verse by verse.</p>
        </Link>
        <Link to="/law" className="bento__cell" style={{ gridColumn: "span 3" }}>
          <img className="bento__icon" src="/assets/brand/icons/icon-2.png" alt="" width={28} height={28} loading="lazy" />
          <span className="bento__count">{s ? `${nf.format(s.laws)} laws · ${nf.format(s.precepts)} precepts` : "The handbook and the precepts"}</span>
          <span className="bento__title">The Law</span>
          <p className="bento__blurb">The handbook and the precept index, every law with its scriptures.</p>
        </Link>
        <Link to="/encyclopedia" className="bento__cell" style={{ gridColumn: "span 3" }}>
          <img className="bento__icon" src="/assets/brand/icons/icon-5.png" alt="" width={28} height={28} loading="lazy" />
          <span className="bento__count">{s ? `${s.encyclopedia} subjects` : "Subjects gathered from the notes"}</span>
          <span className="bento__title">Encyclopedia</span>
          <p className="bento__blurb">Subjects gathered from across the notes: the feasts, the priesthood, the covenant.</p>
        </Link>
      </GlowGrid>
    </section>
  );
}

function Passage() {
  const [p, setP] = useState(PASSAGES[0]);
  useEffect(() => { setP(passageOfTheDay()); }, []);
  return (
    <section className="passage" style={{ backgroundImage: "url(/assets/plates/circuit.jpg)" }}>
      <span className="passage__rail" aria-hidden="true">Passage of the day</span>
      <div className="cj-wrap">
        <span className="passage__cmd" aria-hidden="true">
          <b>cyberjudah@library</b>:~<i>$</i> <Typed key={p.ref} text={`cat bible/${p.file}`} />
        </span>
        <blockquote>
          <em>{p.lead}</em>{p.rest}
        </blockquote>
        <p style={{ textAlign: "center", marginTop: "2rem" }}>
          <span className="ref">{p.ref}</span>
          <ReadLink to={p.to}>Read the chapter</ReadLink>
        </p>
      </div>
    </section>
  );
}

function Index() {
  const { stats } = Route.useLoaderData();
  const latestClass = stats?.recent.find((note) => note.kind === "class");
  // Built once, from the first stats seen, and never rebuilt: the scrub controller tears
  // down and restarts its media whenever the scenes array changes identity, and a loader
  // refetch after hydration hands back a new stats object with the same numbers in it.
  const [scenes] = useState(() => buildScrollScrubScenes(stats));
  useTelegramFrontDoor();
  return (
    <div className="cj-shell">
      <SiteNav />
      <main>
        <section className="cj-wrap class-shortcuts" aria-label="Class shortcuts">
          <p>Sabbath classes, 15 Minutes w/ The Captains and Our Hidden History Radio, written up with every scripture they open linked into the text.</p>
          {latestClass ? <ReadLink to={latestClass.url}>Latest class</ReadLink> : null}
          <LampButton to="/classes">Browse classes</LampButton>
        </section>
        <ScrollScrub
          background={<LionFilm />}
          className="lion-journey"
          scenes={scenes}
          theme={scrollScrubTheme}
        />
        <Console />
        {stats ? <Hud stats={stats} /> : null}
        {stats ? <NewThisWeek stats={stats} /> : <div style={{ height: "3rem" }} />}
        <Library stats={stats} />
        <Passage />
      </main>
      <SiteFooter />
      <Motion />
    </div>
  );
}
