import React, { useEffect, useState } from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import { useHistory } from "@docusaurus/router";
import useBaseUrl from "@docusaurus/useBaseUrl";

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

const rooms: { to: string; title: string; blurb: string }[] = [
  {
    to: "/bible",
    title: "The scripture",
    blurb:
      "The King James text with the Apocrypha, every chapter on its own page and every verse on its own anchor. Each chapter carries the notes, laws, precepts and cases that cite it, so a passage and everything taught from it sit together.",
  },
  {
    to: "/study",
    title: "4 Chapters a Day",
    blurb:
      "Notes from the daily reading, session by session, in the order the books are read. Every verse taught is quoted in place, and the scriptures brought in alongside it are nested under the verse they support.",
  },
  {
    to: "/classes/browse",
    title: "Sabbath class notes",
    blurb:
      "The classes written up in full, with the scriptures cited inline and linked back into the text. Read them straight through, or follow a citation into the chapter it came from and keep going.",
  },
];

// Rendered at build time but read on any later day, so the server and the first client
// render must agree: SSR always emits passages[0] and the browser swaps to the day's
// passage on mount. Without this React hydration mismatches every day after a deploy.
function passageOfTheDay() {
  const n = new Date();
  const day = Math.floor(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) / 86400000);
  return passages[day % passages.length];
}

export default function Home() {
  const [q, setQ] = useState("");
  const history = useHistory();
  const searchUrl = useBaseUrl("/search");
  const lion = useBaseUrl("/img/cyber-lion.png");
  const [p, setP] = useState(passages[0]);
  useEffect(() => { setP(passageOfTheDay()); }, []);
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

          <form
            className="cj-find"
            onSubmit={(e) => { e.preventDefault(); if (q.trim()) history.push(`${searchUrl}?q=${encodeURIComponent(q.trim())}`); }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search scripture, notes, laws, and precepts"
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
        </div>
      </section>

      <section className="cj-rooms">
        <div className="cj-rooms-inner">
          {rooms.map((r) => (
            <article key={r.to}>
              <h2><Link to={r.to}>{r.title}</Link></h2>
              <p>{r.blurb}</p>
            </article>
          ))}
        </div>
      </section>
    </Layout>
  );
}
