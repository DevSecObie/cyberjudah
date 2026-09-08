import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, Kicker } from "@/components/site/chrome";

const DATA = "https://data.cyberjudah.io";

export const Route = createFileRoute("/downloads")({
  head: () => ({ meta: [{ title: "Downloads · CyberJudah" }, { name: "description", content: "The whole library as an Obsidian vault, as SQLite, and as JSON." }] }),
  component: Downloads,
});

function Downloads() {
  return (
    <Page>
      <Kicker>~/downloads</Kicker>
      <h1 className="cj-h1">Take it with you.</h1>
      <div className="note prose-page">
        <ul>
          <li><a href={`${DATA}/downloads/vault.zip`}>vault.zip</a>: the whole library as an Obsidian vault (Bible, study notes, class notes, encyclopedia, law, precepts, cases).</li>
          <li><a href={`${DATA}/library.sqlite.gz`}>library.sqlite.gz</a>: the same library as SQLite with FTS5 full-text tables (<code>verses_fts</code>, <code>notes_fts</code>, <code>laws_fts</code>, <code>cases_fts</code>). Open it locally or import it into D1 or Turso.</li>
          <li><a href={`${DATA}/api/cases/index.json`}>cases</a> · <a href={`${DATA}/api/laws/index.json`}>laws</a> · <a href={`${DATA}/api/precepts/index.json`}>precepts</a> · <a href={`${DATA}/api/notes/index.json`}>notes</a>: the data behind the pages, as JSON.</li>
          <li>Any chapter as JSON: <code>{DATA}/api/kjv/&lt;book&gt;/&lt;chapter&gt;.json</code>. The full map is on the <Link to="/api">API page</Link>.</li>
        </ul>
        <p>The Bible text is the public-domain King James Version (1769) with the Apocrypha. The notes are written up from the class recordings and are the source of record for this site; the markdown lives in <a href="https://github.com/DevSecObie/cyberjudah">DevSecObie/cyberjudah</a>.</p>
      </div>
    </Page>
  );
}
