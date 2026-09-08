import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Page, Kicker, ReadLink } from "@/components/site/chrome";
import { api, type MergedCitation } from "@/lib/api";
import { shelf, verseNumbers } from "@/lib/refs";

export const Route = createFileRoute("/concordance/$book")({
  loader: async ({ params }) => {
    const b = await api.concordanceBook(params.book).catch(() => null);
    if (!b) throw notFound();
    return b;
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData ? `${loaderData.book} · Concordance · CyberJudah` : "Concordance · CyberJudah" }, { name: "description", content: loaderData ? `${loaderData.citations} citations into ${loaderData.cited.length} chapters of ${loaderData.book}.` : "" }] }),
  component: ConcordanceBook,
});

const GROUPS: { label: string; shelves: ReturnType<typeof shelf>[] }[] = [
  { label: "Notes and classes", shelves: ["study", "class", "captains", "other"] },
  { label: "Encyclopedia", shelves: ["encyclopedia"] },
  { label: "Cases", shelves: ["case"] },
  { label: "Precepts", shelves: ["precept"] },
  { label: "Laws", shelves: ["law"] },
];

/** Merge the verse spans of a row into one ascending list: ["1-2","1","5","6-8"] -> "1-2, 5-8". */
export function verseList(vv: string[]): string {
  const nums = [...new Set(vv.flatMap((v) => verseNumbers(v)))].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < nums.length; i++) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    out.push(j > i ? `${nums[i]}-${nums[j]}` : String(nums[i]));
    i = j;
  }
  return out.join(", ");
}

export function CitedGroups({ rows }: { rows: MergedCitation[] }) {
  return (
    <>
      {GROUPS.map((g) => {
        const list = rows.filter((r) => g.shelves.includes(shelf({ kind: r.kind, label: r.label, url: r.url })));
        if (!list.length) return null;
        return (
          <div key={g.label} className="cited-group">
            <p className="cj-kicker">{g.label}</p>
            <ul className="cited-rows">
              {list.map((r) => (
                <li key={r.kind + r.url}>
                  <Link to={r.url as never}>{r.label}</Link>
                  {r.verses.length ? <span className="cj-mono"> v. {verseList(r.verses)}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </>
  );
}

function ConcordanceBook() {
  const b = Route.useLoaderData();
  return (
    <Page>
      <Kicker>Concordance · {b.testament}</Kicker>
      <h1 className="cj-h1">{b.book}</h1>
      <p className="cj-lede">{b.citations} citations into {b.cited.length} of {b.chapters} chapters. <Link to="/bible/$book" params={{ book: b.slug }}>Read {b.book}</Link>.</p>
      {b.cited.length ? <p className="alpha cj-mono">{b.cited.map((c) => <a key={c} href={`#ch-${c}`}>{c}</a>)}</p> : <p>Nothing in the library cites {b.book} yet.</p>}
      {b.chapterRows.map((ch) => (
        <section key={ch.chapter} className="book-block" id={`ch-${ch.chapter}`}>
          <h2><Link to="/bible/$book/$chapter" params={{ book: b.slug, chapter: String(ch.chapter) }}>{b.book} {ch.chapter}</Link> <span className="cj-mono" style={{ fontWeight: 400, color: "var(--color-muted)" }}>{ch.cited_by.length}</span></h2>
          <CitedGroups rows={ch.cited_by} />
        </section>
      ))}
      <p style={{ marginTop: "2rem" }}><ReadLink to="/concordance">All books</ReadLink></p>
    </Page>
  );
}
