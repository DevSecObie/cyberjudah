import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";

import { ScrollScrub } from "@/components/scroll-scrub/scroll-scrub";
import { scrollScrubScenes, scrollScrubTheme } from "@/scroll-scrub-scenes";
import { SiteNav, SiteFooter, LampButton, ReadLink, Kicker } from "@/components/site/chrome";
import { Motion } from "@/components/site/motion";
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
  { lead: "Thy word is a lamp", rest: " unto my feet, and a light unto my path.", ref: "Psalms 119:105", to: "/bible/psalms/119#v105" },
  { lead: "Wisdom is the principal thing", rest: "; therefore get wisdom: and with all thy getting get understanding.", ref: "Proverbs 4:7", to: "/bible/proverbs/4#v7" },
  { lead: "Precept upon precept", rest: "; line upon line, line upon line; here a little, and there a little.", ref: "Isaiah 28:10", to: "/bible/isaiah/28#v10" },
  { lead: "Ask for the old paths", rest: ", where is the good way, and walk therein, and ye shall find rest for your souls.", ref: "Jeremiah 6:16", to: "/bible/jeremiah/6#v16" },
  { lead: "Rightly dividing", rest: " the word of truth: study to shew thyself approved.", ref: "2 Timothy 2:15", to: "/bible/2-timothy/2#v15" },
  { lead: "In his law", rest: " doth he meditate day and night.", ref: "Psalms 1:2", to: "/bible/psalms/1#v2" },
  { lead: "To do justly, and to love mercy", rest: ", and to walk humbly with thy God.", ref: "Micah 6:8", to: "/bible/micah/6#v8" },
  { lead: "The law of the Lord is perfect", rest: ", converting the soul.", ref: "Psalms 19:7", to: "/bible/psalms/19#v7" },
];
function passageOfTheDay() {
  const n = new Date();
  const day = Math.floor(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) / 86400000);
  return PASSAGES[day % PASSAGES.length];
}

function SearchBand() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const go = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) navigate({ to: "/search", search: { q: q.trim() } as never });
  };
  const examples = ["Passover", "usury", "Melchizedek", "Ezekiel 37"];
  return (
    <section className="cj-wrap" style={{ padding: "clamp(3rem, 8vh, 6rem) 0" }} data-reveal>
      <h2 className="cj-h2">Search the whole library.</h2>
      <p className="cj-lede">Every verse, every class, every law and case. A word, a phrase in quotes, or a reference like John 3:16.</p>
      <form className="search-form" role="search" onSubmit={go}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search scripture, notes, laws, and cases" aria-label="Search the library" spellCheck={false} autoComplete="off" />
        <button type="submit" className="search-go" aria-label="Search">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4.2-4.2" strokeLinecap="round" /></svg>
        </button>
      </form>
      <ul className="search-eg">
        {examples.map((eg) => (
          <li key={eg}><ReadLink href={`/search?q=${encodeURIComponent(eg)}`}>{eg}</ReadLink></li>
        ))}
      </ul>
    </section>
  );
}

function NewThisWeek({ stats }: { stats: Stats }) {
  if (!stats.recent?.length) return null;
  return (
    <section style={{ padding: "0 0 clamp(3rem, 8vh, 6rem)" }}>
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
      <h2 className="cj-h2">The library.</h2>
      <div className="bento">
        <div className="bento__cell bento__cell--a">
          <span className="bento__count">{s ? `${s.books} books · ${nf.format(s.verses)} verses` : "King James with the Apocrypha"}</span>
          <span className="bento__title">The Bible</span>
          <p className="bento__blurb">Every chapter on its own page, every verse on its own anchor, with what cites it beside it.</p>
          <span style={{ marginTop: "1.1rem", display: "flex", gap: "1.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <LampButton to="/bible">Open the Bible</LampButton>
            <ReadLink to="/bible/genesis/1">Genesis 1</ReadLink>
          </span>
        </div>
        <Link to="/classes" className="bento__cell bento__cell--b bento__cell--plate" style={{ backgroundImage: "url(/assets/plates/stone.jpg)" }}>
          <span className="bento__count">{s ? `${nf.format(s.classes)} classes` : "Sabbath classes"}</span>
          <span className="bento__title">Sabbath Classes</span>
          <p className="bento__blurb">Each class written up in full, scriptures cited inline.</p>
        </Link>
        <Link to="/study" className="bento__cell" style={{ gridColumn: "span 2" }}>
          <span className="bento__count">{s ? `${nf.format(s.studies)} chapters` : "The daily reading"}</span>
          <span className="bento__title">4 Chapters a Day</span>
        </Link>
        <Link to="/captains" className="bento__cell" style={{ gridColumn: "span 2" }}>
          <span className="bento__count">{s ? `${nf.format(s.captains)} episodes` : "Short teachings"}</span>
          <span className="bento__title">The Captains</span>
        </Link>
        <Link to="/cases" className="bento__cell" style={{ gridColumn: "span 2" }}>
          <span className="bento__count">{s ? `${nf.format(s.cases)} judgments · ${nf.format(s.blessings)} kept the law` : "Judgments and blessings"}</span>
          <span className="bento__title">Case Studies</span>
        </Link>
        <a href="https://devsecobie.github.io/cyberjudah/law" className="bento__cell" style={{ gridColumn: "span 3" }}>
          <span className="bento__count">{s ? `${nf.format(s.laws)} laws · ${nf.format(s.precepts)} precepts` : "The handbook and the precepts"}</span>
          <span className="bento__title">The Law</span>
        </a>
        <a href="https://devsecobie.github.io/cyberjudah/encyclopedia" className="bento__cell" style={{ gridColumn: "span 3" }}>
          <span className="bento__count">{s ? `${s.encyclopedia} subjects` : "Subjects gathered from the notes"}</span>
          <span className="bento__title">Encyclopedia</span>
        </a>
      </div>
    </section>
  );
}

function Passage() {
  const [p, setP] = useState(PASSAGES[0]);
  useEffect(() => { setP(passageOfTheDay()); }, []);
  return (
    <section className="passage" style={{ backgroundImage: "url(/assets/plates/paper.jpg)" }}>
      <span className="passage__rail" aria-hidden="true">Passage of the day</span>
      <div className="cj-wrap">
        <blockquote>
          <em>{p.lead}</em>{p.rest}
        </blockquote>
        <p style={{ textAlign: "center", marginTop: "2rem" }}>
          <span className="cj-mono" style={{ color: "inherit", opacity: 0.7, marginRight: "1.25rem" }}>{p.ref}</span>
          <ReadLink to={p.to} ink>Read the chapter</ReadLink>
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
        <SearchBand />
        {stats ? <NewThisWeek stats={stats} /> : null}
        <Library stats={stats} />
        <Passage />
      </main>
      <SiteFooter />
      <Motion />
    </div>
  );
}
