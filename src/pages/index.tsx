import React, { useEffect, useState } from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import { useHistory } from "@docusaurus/router";
import useBaseUrl from "@docusaurus/useBaseUrl";
import stats from "@site/src/data/stats.json";
import books from "@site/static/api/kjv/books.json";

// A passage a day, deterministic from the date: no server, everyone sees the same one,
// and there is a reason to come back tomorrow. `lead` is set in the accent colour.
const passages: { lead: string; rest: string; ref: string; to: string }[] = [
  { lead: "Precept upon precept", rest: "; line upon line, line upon line; here a little, and there a little.", ref: "Isaiah 28:10", to: "/bible/isaiah/28#v10" },
  { lead: "Ask for the old paths", rest: ", where is the good way, and walk therein, and ye shall find rest for your souls.", ref: "Jeremiah 6:16", to: "/bible/jeremiah/6#v16" },
  { lead: "Wisdom is the principal thing", rest: "; therefore get wisdom: and with all thy getting get understanding.", ref: "Proverbs 4:7", to: "/bible/proverbs/4#v7" },
  { lead: "Thy word is a lamp", rest: " unto my feet, and a light unto my path.", ref: "Psalms 119:105", to: "/bible/psalms/119#v105" },
  { lead: "Rightly dividing", rest: " the word of truth: study to shew thyself approved, a workman that needeth not to be ashamed.", ref: "2 Timothy 2:15", to: "/bible/2-timothy/2#v15" },
  { lead: "A famine in the land", rest: ", not a famine of bread, nor a thirst for water, but of hearing the words of the Lord.", ref: "Amos 8:11", to: "/bible/amos/8#v11" },
  { lead: "In his law", rest: " doth he meditate day and night.", ref: "Psalms 1:2", to: "/bible/psalms/1#v2" },
  { lead: "Destroyed for lack of knowledge", rest: ": because thou hast rejected knowledge, I will also reject thee.", ref: "Hosea 4:6", to: "/bible/hosea/4#v6" },
  { lead: "An holy people", rest: " unto the Lord thy God: the Lord thy God hath chosen thee to be a special people unto himself.", ref: "Deuteronomy 7:6", to: "/bible/deuteronomy/7#v6" },
  { lead: "To do justly, and to love mercy", rest: ", and to walk humbly with thy God.", ref: "Micah 6:8", to: "/bible/micah/6#v8" },
  { lead: "The law of the Lord is perfect", rest: ", converting the soul: the testimony of the Lord is sure, making wise the simple.", ref: "Psalms 19:7", to: "/bible/psalms/19#v7" },
  { lead: "If we follow on to know", rest: " the Lord: his going forth is prepared as the morning.", ref: "Hosea 6:3", to: "/bible/hosea/6#v3" },
];

// Rendered at build time but read on any later day, so the server and the first client
// render must agree: SSR always emits passages[0] and the browser swaps to the day's
// passage on mount. Without this React hydration mismatches every day after a deploy.
function passageOfTheDay() {
  const n = new Date();
  const day = Math.floor(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) / 86400000);
  return passages[day % passages.length];
}

// Written by scripts/generate.mjs on every build. Printing them here is what stops that file
// being generated, committed, and read by nothing.
const nf = new Intl.NumberFormat("en-US");
const notes = stats.studies + stats.classes + stats.captains;

// The six places a reader can go, each with what is in it. Counts are live from the build.
const rooms: { to: string; title: string; count: string; blurb: string; kicker: string }[] = [
  { to: "/bible", title: "The Bible", kicker: "READ", count: `${stats.books} books · ${nf.format(stats.verses)} verses`,
    blurb: "King James with the Apocrypha. Every chapter carries the notes, laws, precepts and cases that cite it." },
  { to: "/study", title: "4 Chapters a Day", kicker: "PLAN", count: `${nf.format(stats.studies)} sessions`,
    blurb: "The daily reading, session by session, every verse taught quoted in place." },
  { to: "/classes/browse", title: "Sabbath Classes", kicker: "NOTES", count: `${nf.format(stats.classes)} classes`,
    blurb: "Each class written up in full, scriptures cited inline and linked back into the text." },
  { to: "/captains/browse", title: "The Captains", kicker: "EPISODES", count: `${nf.format(stats.captains)} episodes`,
    blurb: "15 Minutes w/ The Captains: one subject at a time, every scripture quoted where it was read." },
  { to: "/encyclopedia", title: "Encyclopedia", kicker: "SUBJECTS", count: `${stats.encyclopedia} subjects`,
    blurb: "Topics gathered from across the notes: the feasts, the priesthood, the covenant, the Sabbath." },
  { to: "/law", title: "The Law", kicker: "REFERENCE", count: `${nf.format(stats.laws)} laws · ${nf.format(stats.precepts)} precepts · ${nf.format(stats.cases)} cases`,
    blurb: "The handbook, the precept index, the case studies, and a concordance of what cites what." },
];

const lawShelf: { to: string; title: string; count: string }[] = [
  { to: "/law", title: "Handbook", count: `${nf.format(stats.laws)} laws in ${stats.parts} parts` },
  { to: "/precepts", title: "Precepts", count: `${nf.format(stats.precepts)} with references` },
  { to: "/cases", title: "Case Studies", count: `${nf.format(stats.cases)} judgments` },
  { to: "/concordance", title: "Concordance", count: `${nf.format(stats.citedChapters)} chapters cited` },
];

type Latest = { title: string; url: string; date: string; teacher: string; thumb: string; books: string[] } | null;
const latestClass = stats.latest?.class as Latest;
const latestEpisode = stats.latest?.captains as Latest;

const fmtDate = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
};

// The reader stores "book-slug/chapter" on every chapter visit; the home page turns that
// into a way back in. Read on mount only, so the server render and hydration agree.
function useLastChapter() {
  const [last, setLast] = useState<{ label: string; to: string } | null>(null);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("cj-last-chapter");
      if (!raw) return;
      const [slug, ch] = raw.split("/");
      const b = (books as { book: string; slug: string }[]).find((x) => x.slug === slug);
      if (b && ch) setLast({ label: `${b.book} ${ch}`, to: `/bible/${slug}/${ch}` });
    } catch { /* private mode */ }
  }, []);
  return last;
}

function NoteCard({ kicker, note, fallbackTo }: { kicker: string; note: Latest; fallbackTo: string }) {
  if (!note) return null;
  return (
    <Link className="cj-note" to={note.url || fallbackTo}>
      {note.thumb && <img src={note.thumb} alt="" loading="lazy" width={320} height={180} />}
      <div className="cj-note-body">
        <p className="cj-kicker">{kicker} · {fmtDate(note.date)}</p>
        <h3>{note.title}</h3>
        <p className="cj-note-meta">
          {note.teacher && <span>{note.teacher}</span>}
          {note.books?.length > 0 && <span>{note.books.slice(0, 3).join(" · ")}</span>}
        </p>
      </div>
    </Link>
  );
}

export default function Home() {
  const [q, setQ] = useState("");
  const history = useHistory();
  const searchUrl = useBaseUrl("/search");
  const lion = useBaseUrl("/img/cyber-lion.png");
  const [p, setP] = useState(passages[0]);
  useEffect(() => { setP(passageOfTheDay()); }, []);
  const last = useLastChapter();
  return (
    <Layout title="CyberJudah" description="KJV Study Bible with Apocrypha, study notes, class notes, encyclopedia, the law, precepts, and case studies">
      <h1 className="sr-only">CyberJudah</h1>

      <section className="cj-stage">
        <img className="cj-watermark" src={lion} alt="" aria-hidden="true" />
        <div className="cj-stage-inner">
          <figure className="cj-passage">
            <blockquote>
              <em>{p.lead}</em>{p.rest}
            </blockquote>
            <figcaption>
              <Link to={p.to}>{p.ref}</Link>
            </figcaption>
          </figure>

          <p className="cj-tagline">
            A study library built on one idea: a passage and everything taught from it belong on the same page.
            The scripture, the classes, the daily reading, the law and the cases, all cross-linked and all searchable.
          </p>

          <form
            className="cj-find"
            onSubmit={(e) => { e.preventDefault(); if (q.trim()) history.push(`${searchUrl}?q=${encodeURIComponent(q.trim())}`); }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a word, a phrase, or a reference like John 3:16"
              aria-label="Search"
              spellCheck={false}
              autoComplete="off"
            />
            <button type="submit" aria-label="Search">
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <circle cx="11" cy="11" r="7" /><path d="M20 20l-4.2-4.2" strokeLinecap="round" />
              </svg>
            </button>
          </form>

          <div className="cj-cta">
            {last
              ? <Link className="cj-btn cj-btn-primary" to={last.to}>Continue reading {last.label} →</Link>
              : <Link className="cj-btn cj-btn-primary" to="/bible/genesis/1">Open the Bible →</Link>}
            <Link className="cj-btn" to="/study">Start 4 Chapters a Day</Link>
            <Link className="cj-btn" to="/classes/browse">Browse the classes</Link>
          </div>

          <p className="cj-stats">
            <span>{stats.books} books</span>
            <span>{nf.format(stats.verses)} verses</span>
            <span>{nf.format(notes)} notes</span>
            <span>{nf.format(stats.laws)} laws</span>
            <span>{nf.format(stats.precepts)} precepts</span>
            <span>{nf.format(stats.cases)} cases</span>
          </p>
        </div>
      </section>

      {(latestClass || latestEpisode) && (
        <section className="cj-new">
          <div className="cj-new-inner">
            <h2 className="cj-section-head">New this week</h2>
            <div className="cj-new-grid">
              <NoteCard kicker="Sabbath class" note={latestClass} fallbackTo="/classes/browse" />
              <NoteCard kicker="15 Minutes w/ The Captains" note={latestEpisode} fallbackTo="/captains/browse" />
            </div>
          </div>
        </section>
      )}

      <section className="cj-rooms">
        <div className="cj-rooms-inner">
          <h2 className="cj-section-head">What is here</h2>
          <div className="cj-rooms-grid">
            {rooms.map((r) => (
              <Link key={r.to} className="cj-room" to={r.to}>
                <p className="cj-kicker">{r.kicker}</p>
                <h3>{r.title}</h3>
                <p className="cj-room-count">{r.count}</p>
                <p className="cj-room-blurb">{r.blurb}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="cj-shelves">
        <div className="cj-shelves-inner">
          <h2 className="cj-section-head">The law, and what is taught from it</h2>
          <ul className="cj-shelf-grid">
            {lawShelf.map((sh) => (
              <li key={sh.to}>
                <Link to={sh.to}>{sh.title}</Link>
                <span>{sh.count}</span>
              </li>
            ))}
          </ul>
          <p className="cj-shelves-foot">
            <Link to="/about">About this library</Link> ·{" "}
            <Link to="/api">the whole thing as JSON</Link> ·{" "}
            <Link to="/downloads">downloads</Link>.
          </p>
        </div>
      </section>
    </Layout>
  );
}
