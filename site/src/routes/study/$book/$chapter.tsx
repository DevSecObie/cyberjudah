import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Page, ReadLink } from "@/components/site/chrome";
import { NoteBody } from "@/components/site/note-body";
import { CiteLanding } from "@/components/site/return-bar";
import { NoteWithContents } from "@/components/site/contents-rail";
import { api } from "@/lib/api";
import { renderNote, plainLede } from "@/lib/markdown";

export const Route = createFileRoute("/study/$book/$chapter")({
  loader: async ({ params }) => {
    const path = `/study/${params.book}/${params.chapter}`;
    const [note, all] = await Promise.all([api.note(path).catch(() => null), api.notes()]);
    if (!note) throw notFound();
    const siblings = all.filter((n) => n.kind === "study" && n.book === note.book && n.chapters).sort((a, b) => a.chapters![0] - b.chapters![0]);
    const i = siblings.findIndex((n) => n.url === note.url);
    return { note, html: renderNote(note.body), lede: plainLede(note.body), prev: siblings[i - 1] ?? null, next: siblings[i + 1] ?? null };
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData ? `${loaderData.note.title} · CyberJudah` : "CyberJudah" }, { name: "description", content: loaderData?.lede ?? "" }] }),
  component: StudyChapter,
});

function StudyChapter() {
  const { note, html, prev, next } = Route.useLoaderData();
  const { book, chapter } = Route.useParams();
  return (
    <Page>
      <div className="note-head">
        <p className="cj-kicker">4 Chapters a Day · {note.book} {chapter}</p>
        <h1 className="cj-h1">{note.title}</h1>
        <ReadLink to={`/bible/${book}/${chapter}`}>Read {note.book} {chapter}</ReadLink>
      </div>
      <CiteLanding>
        <NoteWithContents>
          <NoteBody html={html} />
        </NoteWithContents>
      </CiteLanding>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginTop: "3rem", paddingTop: "1.5rem", borderTop: "1px solid var(--color-hair)" }}>
        {prev ? <Link to={prev.url as never} className="read-link"><span>{prev.title}</span><span aria-hidden="true">→</span></Link> : <span />}
        {next ? <Link to={next.url as never} className="read-link"><span>{next.title}</span><span aria-hidden="true">→</span></Link> : <Link to="/study" className="read-link"><span>All chapters</span><span aria-hidden="true">→</span></Link>}
      </div>
    </Page>
  );
}
