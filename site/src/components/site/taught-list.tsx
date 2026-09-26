import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { taughtForPassages, taughtInChapter } from "@/lib/teachings";
import { bookName, clock, FEED_LABEL, groupTaught, watchAt, type PassageQuery, type TaughtRecording } from "@/lib/teaching-refs";

export type Taught = { recordings: TaughtRecording[]; total: number; state: "loading" | "ready" | "unavailable" };

const cache = new Map<string, Promise<Taught>>();

/** The recordings that taught this chapter, narrowed to the selected verses. */
export function useTaught(slug: string, chapter: number, verses: number[]): Taught {
  const key = `${slug}/${chapter}/${verses.join(",")}`;
  const [taught, setTaught] = useState<Taught>({ recordings: [], total: 0, state: "loading" });
  useEffect(() => {
    let alive = true;
    let pending = cache.get(key);
    if (!pending) {
      pending = taughtInChapter({ data: { slug, chapter, verses } })
        .then((r): Taught => ({ recordings: groupTaught(r.rows), total: r.total, state: r.unavailable ? "unavailable" : "ready" }))
        .catch((): Taught => ({ recordings: [], total: 0, state: "unavailable" }));
      cache.set(key, pending);
      pending.then((t) => { if (t.state === "unavailable") cache.delete(key); });
    }
    pending.then((t) => { if (alive) setTaught(t); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return taught;
}

const MOMENTS_SHOWN = 6;

export function TaughtList({ taught, intro = "Where this was heard in the recordings", limit }: { taught: Taught; intro?: string; limit?: number }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [everything, setEverything] = useState(false);
  if (taught.state === "loading") return <p className="study__empty">Loading</p>;
  if (!taught.recordings.length) return <p className="study__empty">No recording has been matched to these verses yet.</p>;
  return (
    <>
      <p className="taught__note">
        {intro}, found in the automatic captions. Times link to the moment on YouTube.
        {taught.total > taught.recordings.length ? ` Showing the ${taught.recordings.length} recordings that return to it most, of ${taught.total}.` : ""}
      </p>
      <ul className="cited taught">
        {(limit && !everything ? taught.recordings.slice(0, limit) : taught.recordings).map((rec) => {
          const all = open[rec.video];
          const moments = all ? rec.moments : rec.moments.slice(0, MOMENTS_SHOWN);
          return (
            <li key={rec.video} className="taught__item">
              <small>{[FEED_LABEL[rec.feed] ?? rec.feed, rec.date].filter(Boolean).join(" · ")}</small>
              <a className="taught__title" href={watchAt(rec.video, rec.moments[0]?.start ?? 0)} target="_blank" rel="noreferrer">{rec.title}</a>
              <span className="taught__moments">
                {moments.map((m) => (
                  <a key={`${m.label}@${m.start}`} className="chip" href={watchAt(rec.video, m.start)} target="_blank" rel="noreferrer"
                    title={m.heard ? `Heard as “${m.heard}”` : undefined}
                    aria-label={`${m.label.replace(/^v/, "Verse ")}, ${m.timing === "caption" ? "at" : "in the passage from"} ${clock(m.start)}`}>
                    {m.label} · {clock(m.start)}
                  </a>
                ))}
                {rec.moments.length > MOMENTS_SHOWN ? (
                  <button type="button" className="chip" onClick={() => setOpen((o) => ({ ...o, [rec.video]: !all }))}>
                    {all ? "Fewer" : `+${rec.moments.length - MOMENTS_SHOWN} more`}
                  </button>
                ) : null}
                {rec.note ? <Link className="taught__notes" to={rec.note as never}>Notes →</Link> : null}
              </span>
            </li>
          );
        })}
      </ul>
      {limit && taught.recordings.length > limit ? (
        <button type="button" className="chip taught__all" onClick={() => setEverything((v) => !v)}>
          {everything ? "Show fewer" : `Show all ${taught.recordings.length}`}
        </button>
      ) : null}
    </>
  );
}

/**
 * "Taught in the recordings" for a library page: the recordings that return most to the
 * scripture the page rests on. Renders nothing until there is something to show.
 */
export function TaughtSection({ passages, subject }: { passages: PassageQuery[]; subject: string }) {
  const key = JSON.stringify(passages.map((p) => [p.slug, p.chapter, p.first ?? 0, p.last ?? 0]));
  const [taught, setTaught] = useState<Taught>({ recordings: [], total: 0, state: "loading" });
  useEffect(() => {
    if (!passages.length) return;
    let alive = true;
    const names = new Map(passages.map((p) => [p.slug, p.book ?? bookName(p.slug)]));
    taughtForPassages({ data: { passages } })
      .then((r) => {
        const recordings = groupTaught(r.rows, [], (row, verses) => `${names.get(row.slug ?? "") ?? bookName(row.slug ?? "")} ${row.chapter}:${verses}`);
        if (alive) setTaught({ recordings, total: r.total, state: r.unavailable ? "unavailable" : "ready" });
      })
      .catch(() => { if (alive) setTaught({ recordings: [], total: 0, state: "unavailable" }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (taught.state !== "ready" || !taught.recordings.length) return null;
  return (
    <section className="taught-section" aria-labelledby="taught-heading">
      <h2 id="taught-heading" className="taught-section__title">Taught in the recordings</h2>
      <TaughtList taught={taught} limit={8} intro={`Recordings that return most to the scripture ${subject} rests on`} />
    </section>
  );
}
