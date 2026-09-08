import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Page, Kicker, ReadLink } from "@/components/site/chrome";
import { NoteBody } from "@/components/site/note-body";
import { CiteLanding } from "@/components/site/return-bar";
import { NoteWithContents } from "@/components/site/contents-rail";
import { api } from "@/lib/api";
import { renderNote, plainLede } from "@/lib/markdown";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/encyclopedia/$slug")({
  loader: async ({ params }) => {
    const [note, all] = await Promise.all([api.note(`/encyclopedia/${params.slug}`).catch(() => null), api.encyclopedia()]);
    if (!note) throw notFound();
    const i = all.findIndex((e) => e.slug === params.slug);
    const heads = [...note.body.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
    return { note, html: renderNote(note.body), lede: note.summary || plainLede(note.body), heads, prev: all[i - 1] ?? null, next: all[i + 1] ?? null };
  },
  head: ({ loaderData, match }) => pageHead([{ title: loaderData ? `${loaderData.note.title} · Encyclopedia · CyberJudah` : "Encyclopedia · CyberJudah" }, { name: "description", content: loaderData?.lede ?? "" }], match, { type: "article" }),
  component: EncyclopediaEntry,
});

const anchor = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function EncyclopediaEntry() {
  const { note, html, heads, prev, next } = Route.useLoaderData();
  return (
    <Page>
      <div className="note-head">
        <Kicker>Encyclopedia</Kicker>
        <h1 className="cj-h1">{note.title}</h1>
        {note.summary ? <p className="cj-lede" style={{ marginBottom: 0 }}>{note.summary}</p> : null}
      </div>
      <CiteLanding>
        <NoteWithContents>
          <NoteBody html={html} />
        </NoteWithContents>
      </CiteLanding>
      <div className="pager">
        {prev ? <Link to="/encyclopedia/$slug" params={{ slug: prev.slug }} className="read-link"><span>{prev.title}</span><span aria-hidden="true">→</span></Link> : <ReadLink to="/encyclopedia">All subjects</ReadLink>}
        {next ? <Link to="/encyclopedia/$slug" params={{ slug: next.slug }} className="read-link"><span>{next.title}</span><span aria-hidden="true">→</span></Link> : <ReadLink to="/encyclopedia">All subjects</ReadLink>}
      </div>
    </Page>
  );
}
