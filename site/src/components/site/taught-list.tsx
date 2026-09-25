import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { taughtInChapter } from "@/lib/teachings";
import { clock, FEED_LABEL, groupTaught, watchAt, type TaughtRecording } from "@/lib/teaching-refs";

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

export function TaughtList({ taught }: { taught: Taught }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (taught.state === "loading") return <p className="study__empty">Loading</p>;
  if (!taught.recordings.length) return <p className="study__empty">No recording has been matched to these verses yet.</p>;
  return (
    <>
      <p className="taught__note">
        Where this was heard in the recordings, found in the automatic captions. Times link to the moment on YouTube.
        {taught.total > taught.recordings.length ? ` Showing the ${taught.recordings.length} recordings that return to it most, of ${taught.total}.` : ""}
      </p>
      <ul className="cited taught">
        {taught.recordings.map((rec) => {
          const all = open[rec.video];
          const moments = all ? rec.moments : rec.moments.slice(0, MOMENTS_SHOWN);
          return (
            <li key={rec.video} className="taught__item">
              <small>{[FEED_LABEL[rec.feed] ?? rec.feed, rec.date].filter(Boolean).join(" · ")}</small>
              <a className="taught__title" href={watchAt(rec.video, rec.moments[0]?.start ?? 0)} target="_blank" rel="noreferrer">{rec.title}</a>
              <span className="taught__moments">
                {moments.map((m) => (
                  <a key={`${m.verses}@${m.start}`} className="chip" href={watchAt(rec.video, m.start)} target="_blank" rel="noreferrer"
                    title={m.heard ? `Heard as “${m.heard}”` : undefined}
                    aria-label={`Verse ${m.verses}, ${m.timing === "caption" ? "at" : "in the passage from"} ${clock(m.start)}`}>
                    v{m.verses} · {clock(m.start)}
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
    </>
  );
}
