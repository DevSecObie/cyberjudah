import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";

import { ScrollScrub } from "@/components/scroll-scrub/scroll-scrub";
import { scrollScrubScenes, scrollScrubTheme } from "@/scroll-scrub-scenes";
import { SiteNav, SiteFooter, LampButton, ReadLink, Kicker } from "@/components/site/chrome";
import { Motion } from "@/components/site/motion";
import { Matrix } from "@/components/site/matrix";
import { GlowGrid, CountUp, Typed } from "@/components/site/cyber";
import { api, fmtDate, nf, thumbUrl, type Stats } from "@/lib/api";

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

// A passage a day, deterministic from the date, so everyone sees the same one and there is a
// reason to come back tomorrow. The first entry renders on the server; the browser swaps in
// the day's passage on mount so hydration always matches.
const PASSAGES = [
  { lead: "Thy word is a lamp", rest: " unto my feet, and a light unto my path.", ref: "Psalms 119:105", to: "/bible/psalms/119#v105", file: "psalms/119.txt" },
  { lead: "Wisdom is the principal thing", rest: "; therefore get wisdom: and with all thy getting get understanding.", ref: "Proverbs 4:7", to: "/bible/proverbs/4#v7", file: "proverbs/4.txt" },
  { lead: "Precept upon precept", rest: "; line upon line, line upon line; here a little, and there a little.", ref: "Isaiah 28:10", to: "/bible/isaiah/28#v10", file: "isaiah/28.txt" },
  { lead: "Ask for the old paths", rest: ", where is the good way, and walk therein, and ye shall find rest for your souls.", ref: "Jeremiah 6:16", to: "/bible/jeremiah/6#v16", file: "jeremiah/6.txt" },
  { lead: "Rightly dividing", rest: " the word of truth: study to shew thyself approved.", ref: "2 Timothy 2:15", to: "/bible/2-timothy/2#v15", file: "2-timothy/2.txt" },
  { lead: "In his law", rest: " doth he meditate day and night.", ref: "Psalms 1:2", to: "/bible/psalms/1#v2", file: "psalms/1.txt" },
  { lead: "To do justly, and to love mercy", rest: ", and to walk humbly with thy God.", ref: "Micah 6:8", to: "/bible/micah/6#v8", file: "micah/6.txt" },
  { lead: "The law of the Lord is perfect", rest: ", converting the soul.", ref: "Psalms 19:7", to: "/bible/psalms/19#v7", file: "psalms/19.txt" },
  { lead: "Destroyed for lack of knowledge", rest: ": because thou hast rejected knowledge, I will also reject thee.", ref: "Hosea 4:6", to: "/bible/hosea/4#v6", file: "hosea/4.txt" },
  { lead: "An holy people", rest: " unto the Lord thy God: the Lord thy God hath chosen thee to be a special people unto himself.", ref: "Deuteronomy 7:6", to: "/bible/deuteronomy/7#v6", file: "deuteronomy/7.txt" },
];
function passageOfTheDay() {
  const n = new Date();
  const day = Math.floor(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) / 86400000);
  return PASSAGES[day % PASSAGES.length];
}

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
              <li key={eg}><ReadLink href={`/search?q=${encodeURIComponent(eg)}`}>{eg}</ReadLink></li>
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
          <span className="bento__title">The Captains</span>
          <p className="bento__blurb">15 Minutes w/ The Captains: one subject at a time.</p>
        </Link>
        <Link to="/cases" className="bento__cell" style={{ gridColumn: "span 2" }}>
          <img className="bento__icon" src="/assets/brand/icons/icon-3.png" alt="" width={28} height={28} loading="lazy" />
          <span className="bento__count">{s ? `${nf.format(s.cases)} judgments · ${nf.format(s.blessings)} kept the law` : "Judgments and blessings"}</span>
          <span className="bento__title">Case Studies</span>
          <p className="bento__blurb">The judgments, and those who kept the law and were blessed.</p>
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
  return (
    <div className="cj-shell">
      <SiteNav />
      <main>
        <ScrollScrub scenes={scrollScrubScenes} theme={scrollScrubTheme} />
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
