import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, Kicker } from "@/components/site/chrome";
import { pageHead } from "@/lib/head";

const DATA = "https://data.cyberjudah.io";
const ROWS: [string, string][] = [
  ["/api/kjv/books.json", "the 81 books: name, slug, testament, chapter and verse counts"],
  ["/api/kjv/<book-slug>/<chapter>.json", "one chapter: {book, chapter, verses: [{verse, text}]}"],
  ["/api/concordance/<book-slug>/<chapter>.json", "everything that cites the chapter, one row per passage"],
  ["/api/concordance/<book-slug>.json", "a whole book, one row per citing document per chapter"],
  ["/api/concordance/index.json", "which chapters of each book are cited"],
  ["/api/xref/<book-slug>/<chapter>.json", "cross references for each verse"],
  ["/api/web/<book-slug>/<chapter>.json", "the same chapter in the World English Bible"],
  ["/api/laws/index.json", "the handbook: parts and sections"],
  ["/api/laws/<SECTION>.json", "one section with every law, its references and the verses, e.g. /api/laws/10A.json"],
  ["/api/precepts/index.json", "the precept index"],
  ["/api/precepts/<slug>.json", "one precept with its references and the verses"],
  ["/api/cases/index.json", "the case studies"],
  ["/api/cases/<slug>.json", "one case, with its laws, precepts, related cases and where it was taught"],
  ["/api/notes/index.json", "every study note, class, episode and encyclopedia entry"],
  ["/api/notes/<site-path>.json", "one note with its markdown body, e.g. /api/notes/study/genesis/2.json"],
  ["/api/encyclopedia/index.json", "the encyclopedia"],
  ["/api/topics/index.json, /api/topics/<slug>.json", "topics, and what carries each one"],
  ["/api/stats.json", "the counts on the home page and the ten newest notes"],
  ["/api/index.json", "every endpoint above, as a map"],
  ["/search/classes.json, /search/captains.json", "browse feeds: title, url, date, teacher, thumb, books, topics"],
  ["/pagefind/", "a sharded full-text index; load pagefind/pagefind.js and search every verse, note, law, precept and case"],
  ["/library.sqlite.gz", "the whole library as SQLite with FTS5 tables"],
  ["/classes/rss.xml, /captains/rss.xml, /study/rss.xml", "feeds, each also as feed.json"],
  ["/llms.txt", "a summary of the library for language models"],
  ["/pointer.json, /manifest.json", "which build is being served, and what is in it"],
];

export const Route = createFileRoute("/api")({
  head: ({ match }) => pageHead([{ title: "API · CyberJudah" }, { name: "description", content: "The whole library as static JSON, a full-text index and SQLite, served from data.cyberjudah.io with CORS open." }], match),
  component: Api,
});

function Api() {
  return (
    <Page>
      <Kicker>~/api</Kicker>
      <h1 className="cj-h1">The library as data.</h1>
      <div className="note prose-page">
        <p>Everything this site renders is read from one static data set at <a href={DATA}><code>{DATA}</code></a>: plain JSON files, a full-text index and a SQLite database, rebuilt from the notes on every push and served with CORS open. Any page, script or app can read the same files. Paths below are relative to that host.</p>
        <table className="api-table">
          <tbody>
            {ROWS.map(([p, d]) => <tr key={p}><td><code>{p}</code></td><td>{d}</td></tr>)}
          </tbody>
        </table>
        <p>Every chapter has a concordance file. A chapter that nothing cites returns <code>{`{"cited_by": []}`}</code> rather than a 404, so walking the book index never breaks. Book slugs are lowercase with hyphens: <code>genesis</code>, <code>1-samuel</code>, <code>sirach</code>, <code>esther-greek</code>, <code>epistle-of-jeremiah</code>. Site-relative URLs inside the data (<code>/bible/genesis/1</code>, <code>/classes/2026/...</code>) are routes on this site.</p>
        <p>Examples: <a href={`${DATA}/api/kjv/judges/16.json`}><code>kjv/judges/16.json</code></a> · <a href={`${DATA}/api/concordance/judges/16.json`}><code>concordance/judges/16.json</code></a> · <a href={`${DATA}/api/laws/10A.json`}><code>laws/10A.json</code></a> · <a href={`${DATA}/api/cases/achan.json`}><code>cases/achan.json</code></a> · <a href={`${DATA}/api/stats.json`}><code>stats.json</code></a></p>
        <p>The data set is versioned: <a href={`${DATA}/pointer.json`}><code>pointer.json</code></a> names the commit on the <code>data</code> branch of <a href="https://github.com/DevSecObie/cyberjudah">DevSecObie/cyberjudah</a> that holds the current build, and the same files are served content-addressed from <code>cdn.jsdelivr.net/gh/DevSecObie/cyberjudah@&lt;commit&gt;/</code>. The engine that builds it, and the full contract, is in <code>engine/</code> in that repository. See also <Link to="/downloads">Downloads</Link>.</p>
      </div>
    </Page>
  );
}
