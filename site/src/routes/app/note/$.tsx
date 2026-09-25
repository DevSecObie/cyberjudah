import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, type MouseEvent } from "react";

import { Empty, Icon, Img, Skeleton, openVideo, useGo, when } from "@/components/app/ui";
import { api } from "@/lib/api";
import { renderNote } from "@/lib/markdown";
import { sharePage, tg, useTelegramButtons } from "@/lib/telegram";

const KIND: Record<string, string> = { class: "Sabbath class", captains: "15 Min w/ Captains", history: "Our Hidden History", study: "4 Chapters a Day", encyclopedia: "Encyclopedia" };

/** A class, episode, study or encyclopedia note: the recording on top, the write-up below. */
export const Route = createFileRoute("/app/note/$")({ component: NoteScreen });

function NoteScreen() {
  const { _splat } = Route.useParams();
  const path = `/${String(_splat ?? "").replace(/^\/+|\/+$/g, "")}`;
  const go = useGo();
  const note = useQuery({ queryKey: ["note", path], queryFn: () => api.note(path), staleTime: 5 * 60_000, retry: 1 });
  const html = useMemo(() => (note.data ? renderNote(note.data.body) : ""), [note.data]);
  const video = note.data?.videoId ?? null;

  useTelegramButtons(
    note.data ? { text: "Share", onClick: () => sharePage(undefined, note.data!.title) } : null,
    video ? { text: "▶ Watch", onClick: () => openVideo(video) } : null,
  );
  useEffect(() => {
    if (!html || !window.location.hash) return;
    const t = window.setTimeout(() => document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView({ block: "start" }), 60);
    return () => window.clearTimeout(t);
  }, [html]);

  // Links in the write-up open the app's own screens where there is one.
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest("a");
    const href = a?.getAttribute("href") ?? "";
    if (!a || !href.startsWith("/") || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    go(href);
  };

  if (note.isPending) return <main className="app-screen"><Skeleton rows={6} /></main>;
  if (note.isError || !note.data) return <main className="app-screen"><Empty title="This note did not load">It may have moved. Search for it instead.</Empty></main>;
  const n = note.data;
  return (
    <main className="app-screen">
      <header className="app-note-head">
        <p className="app-kicker">{[KIND[n.kind] ?? "", when(n.date, n.teacher)].filter(Boolean).join(" · ")}</p>
        <h1>{n.title}</h1>
      </header>
      {video ? (
        <button type="button" className="app-watch" onClick={() => openVideo(video)} aria-label={`Watch ${n.title}`}>
          <Img src={`https://img.youtube.com/vi/${encodeURIComponent(video)}/hqdefault.jpg`} eager />
          <span><Icon name="play" size={18} /> Watch the recording</span>
        </button>
      ) : null}
      <div className="app-note" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
      {!tg() ? <button type="button" className="app-chip" style={{ alignSelf: "flex-start" }} onClick={() => history.back()}>← Back</button> : null}
    </main>
  );
}
