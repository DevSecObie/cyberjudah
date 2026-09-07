// Smoke checks plus a URL/anchor inventory for comparing future architecture changes.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const build = path.join(root, "build");
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
const files = walk(build);
const relative = (file) => path.relative(build, file).split(path.sep).join("/");
const html = files.filter((file) => file.endsWith(".html"));
const anchors = Object.fromEntries(html.map((file) => [relative(file),
  [...new Set([...fs.readFileSync(file, "utf8").matchAll(/\sid=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map((m) => m[1] ?? m[2] ?? m[3]))].sort()]));
for (const required of ["index.html", "classes/browse.html", "captains/browse.html", "bible/numbers/15.html",
  "classes/archive/index.html", "search.html", "sw.js", "manifest.json", "pagefind/pagefind.js", "classes/rss.xml", "study/feed.json"]) {
  assert.ok(fs.existsSync(path.join(build, required)), `Missing ${required}`);
}
assert.ok(anchors["bible/numbers/15.html"].includes("v32"), "Numbers 15:32 anchor missing");
for (const file of files.filter((file) => relative(file).startsWith("api/") && file.endsWith(".json"))) {
  JSON.parse(fs.readFileSync(file, "utf8"));
}
for (const name of ["classes", "captains"]) {
  const rows = JSON.parse(fs.readFileSync(path.join(build, `search/${name}.json`), "utf8"));
  assert.ok(Array.isArray(rows) && rows.length, `${name} browse index is empty`);
  for (const row of rows) {
    assert.ok(fs.existsSync(path.join(build, row.url.replace(/^\//, "") + ".html")), `Missing note: ${row.url}`);
  }
}
const compare = process.argv[2];
if (compare) {
  const before = JSON.parse(fs.readFileSync(compare, "utf8"));
  for (const [url, ids] of Object.entries(before.anchors)) {
    assert.ok(anchors[url], `Removed URL: ${url}`);
    for (const id of ids) assert.ok(anchors[url].includes(id), `Removed anchor: ${url}#${id}`);
  }
}
const manifest = { htmlPages: html.length, apiJsonFiles: files.filter((file) => relative(file).startsWith("api/") && file.endsWith(".json")).length, anchors };
fs.mkdirSync(path.join(root, "build-profile"), { recursive: true });
fs.writeFileSync(path.join(root, "build-profile", "url-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Verified ${manifest.htmlPages} HTML pages, ${manifest.apiJsonFiles} API JSON files, note targets, feeds, redirect, search/PWA assets and Numbers 15:32.${compare ? " No URLs or anchors removed against supplied manifest." : " URL/anchor inventory saved."}`);
