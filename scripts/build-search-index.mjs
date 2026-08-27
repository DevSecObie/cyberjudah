// Build the sharded search index from the records generate.mjs emits.
//
//   node scripts/build-search-index.mjs      (runs as part of npm run sync)
//
// Reads .search-records.json (gitignored, written by generate.mjs) and writes a Pagefind
// index to static/pagefind (gitignored). Every verse, law, precept, case, and note is its
// own record with its own URL, so results stay verse-precise. The browser downloads only
// the index shards a query touches, a few hundred KB at most, instead of the 20 MB the
// flat JSON scan had grown to. Class transcripts can be added as records without changing
// anything here.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as pagefind from "pagefind";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "static", "pagefind");
const records = JSON.parse(fs.readFileSync(path.join(ROOT, ".search-records.json"), "utf8"));

const { index, errors: createErrors } = await pagefind.createIndex();
if (createErrors?.length) { console.error(createErrors); process.exit(1); }

const escapeHtml = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
for (const r of records) {
  let errors;
  if (r.anchored) {
    // One record per chapter (or handbook section), one anchored heading per verse (or law),
    // so the client gets verse-precise sub-results from a single fragment.
    const body = r.anchored.map(([id, label, text]) => `<h6 id="${id}">${escapeHtml(label)}</h6><p>${escapeHtml(text)}</p>`).join("\n");
    const html = `<!DOCTYPE html><html lang="en"><body data-pagefind-body>` +
      `<span data-pagefind-meta="title">${escapeHtml(r.title)}</span>` +
      `<span data-pagefind-meta="kind">${r.kind}</span>` +
      `<span data-pagefind-filter="kind">${r.kind}</span>${body}</body></html>`;
    ({ errors } = await index.addHTMLFile({ url: r.url, content: html }));
  } else {
    ({ errors } = await index.addCustomRecord({
      url: r.url,
      // The title is prepended so it is searchable (a law id, a class title), but the
      // search page renders meta.title, not the excerpt's copy of it.
      content: `${r.title}. ${r.content}`,
      language: "en",
      meta: { title: r.title, kind: r.kind, ...(r.sub ? { sub: r.sub } : {}) },
      filters: { kind: [r.kind] },
    }));
  }
  if (errors?.length) { console.error(r.url, errors); process.exit(1); }
}

fs.rmSync(OUT, { recursive: true, force: true });
const { errors: writeErrors } = await index.writeFiles({ outputPath: OUT });
if (writeErrors?.length) { console.error(writeErrors); process.exit(1); }
await pagefind.close();

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(OUT);
const bytes = files.reduce((a, f) => a + fs.statSync(f).size, 0);
console.error(`search index: ${records.length} records · ${files.length} files · ${(bytes / 1048576).toFixed(1)} MB sharded`);
