import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Page, Kicker, ReadLink } from "@/components/site/chrome";
import { NoteBody } from "@/components/site/note-body";
import { NoteWithContents } from "@/components/site/contents-rail";
import { CiteLanding } from "@/components/site/return-bar";
import { api, fmtDate } from "@/lib/api";
import { renderNote, plainLede } from "@/lib/markdown";
import { hms } from "../index";

export const Route = createFileRoute("/history/$year/$slug")({
  loader: async ({ params }) => {
    const [ep, all] = await Promise.all([api.episode(`${params.year}/${params.slug}`).catch(() => null), api.history()]);
    if (!ep) throw notFound();
    const i = all.findIndex((r) => r.slug === ep.slug);
    return { ep, html: ep.body ? renderNote(ep.body) : null, lede: ep.body ? plainLede(ep.body) : (ep.turns[0]?.text.slice(0, 160) ?? ""), prev: all[i + 1] ?? null, next: all[i - 1] ?? null };
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData ? `${loaderData.ep.episode ? `EP ${loaderData.ep.episode}: ` : ""}${loaderData.ep.title} · Our Hidden History · CyberJudah` : "Our Hidden History · CyberJudah" }, { name: "description", content: loaderData?.lede ?? "" }] }),
  component: EpisodePage,
});

const clock = (s: number) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60); return (h ? `${h}:${String(m).padStart(2, "0")}` : String(m)) + ":" + String(x).padStart(2, "0"); };

function EpisodePage() {
  const { ep, html, prev, next } = Route.useLoaderData();
  const [at, setAt] = useState<number | null>(null);
  const player = useRef<HTMLDivElement>(null);
  // #t=1234 in the URL (from search) opens the transcript at that line and cues the recording there.
  useEffect(() => {
    const m = window.location.hash.match(/^#t=(\d+)/);
    if (!m) return;
    const t = Number(m[1]);
    const idx = ep.turns.findIndex((x, i) => x.t <= t && (ep.turns[i + 1]?.t ?? Infinity) > t);
    const el = document.getElementById(`turn-${idx >= 0 ? idx : 0}`);
    if (el) { el.scrollIntoView({ block: "center" }); el.classList.add("cite-hit"); }
    setAt(t);
  }, [ep.slug]);
  const seek = (t: number) => { setAt(Math.floor(t)); player.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); };
  const src = `https://www.youtube-nocookie.com/embed/${ep.videoId}?rel=0${at !== null ? `&start=${at}&autoplay=1` : `&start=${Math.floor(ep.start)}`}`;
  return (
    <Page>
      <div className="note-head">
        <Kicker>Our Hidden History{ep.episode ? ` · Episode ${ep.episode}` : ""}</Kicker>
        <h1 className="cj-h1">{ep.title}</h1>
        <p className="cj-mono" style={{ color: "var(--color-muted)" }}>{[ep.date ? fmtDate(ep.date) : "", ep.duration ? hms(ep.duration) : "", `${ep.words.toLocaleString()} words`, ep.teacher].filter(Boolean).join(" · ")}</p>
      </div>
      <div ref={player} className="episode__player">
        <iframe key={src} src={src} title={ep.title} loading="lazy" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      </div>
      {html ? (
        <CiteLanding>
          <NoteWithContents>
            <NoteBody html={html} />
          </NoteWithContents>
        </CiteLanding>
      ) : null}
      <section className="transcript" aria-label="Transcript">
        <p className="cj-kicker">{html ? "The transcript" : "Verbatim"}</p>
        <p className="cj-mono transcript__note">Every word as spoken, from {clock(ep.start)} where the show begins. Captions are machine-made; names and scripture references may be misspelt until the episode is written up. Click a time to play from there.</p>
        <div className="transcript__turns">
          {ep.turns.map((turn, i) => (
            <p key={i} id={`turn-${i}`} className="transcript__turn">
              <button type="button" className="transcript__t cj-mono" onClick={() => seek(turn.t)} aria-label={`Play from ${clock(turn.t)}`}>{clock(turn.t)}</button>
              {turn.text}
            </p>
          ))}
        </div>
      </section>
      <div className="pager">
        {prev ? <Link to={prev.url as never} className="read-link"><span>{prev.episode ? `EP ${prev.episode} · ` : ""}{prev.title}</span><span aria-hidden="true">→</span></Link> : <ReadLink to="/history">All episodes</ReadLink>}
        {next ? <Link to={next.url as never} className="read-link"><span>{next.episode ? `EP ${next.episode} · ` : ""}{next.title}</span><span aria-hidden="true">→</span></Link> : <ReadLink to="/history">All episodes</ReadLink>}
      </div>
    </Page>
  );
}
