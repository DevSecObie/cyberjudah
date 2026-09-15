import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Page, ReadLink } from "@/components/site/chrome";
import { NoteBody } from "@/components/site/note-body";
import { CiteLanding } from "@/components/site/return-bar";
import { NoteWithContents } from "@/components/site/contents-rail";
import { api, fmtDate } from "@/lib/api";
import { renderNote, plainLede } from "@/lib/markdown";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/classes/$year/$slug")({
  loader: async ({ params }) => {
    const note = await api.note(`/classes/${params.year}/${params.slug}`).catch(() => null);
    if (!note) throw notFound();
    return { note, html: renderNote(note.body), lede: plainLede(note.body) };
  },
  head: ({ loaderData, match }) => pageHead([{ title: loaderData ? `${loaderData.note.title} · CyberJudah` : "CyberJudah" }, { name: "description", content: loaderData?.lede ?? "" }], match, { type: "article" }),
  component: NotePage,
});

function NotePage() {
  const { note, html } = Route.useLoaderData();
  const { year, slug } = Route.useParams();
  const sourceName = note.date ? `${note.date}-${slug}.md` : `${slug}.md`;
  const editUrl = `https://github.com/DevSecObie/cyberjudah/edit/main/blog/${year}/${sourceName}`;
  return (
    <Page>
      <div className="note-head">
        <p className="cj-kicker">Sabbath class{note.date ? ` · ${fmtDate(note.date)}` : ""}{note.teacher ? ` · ${note.teacher}` : ""}</p>
        <h1 className="cj-h1">{note.title}</h1>
        <div className="note-head__actions">
          <ReadLink to="/classes">All classes</ReadLink>
          <a href={editUrl} target="_blank" rel="noreferrer" className="read-link"><span>Edit this note</span><span aria-hidden="true">↗</span></a>
        </div>
      </div>
      <CiteLanding>
        <NoteWithContents>
          <NoteBody html={html} />
        </NoteWithContents>
      </CiteLanding>
      <p style={{ marginTop: "3rem" }}><Link to="/classes" className="read-link"><span>Back to the classes</span><span aria-hidden="true">→</span></Link></p>
    </Page>
  );
}
