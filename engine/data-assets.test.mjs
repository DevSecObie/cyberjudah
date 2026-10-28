// The real data set, end to end without Cloudflare: build it into a temporary directory, publish
// it to an in-memory bucket, and read it back through the data Worker. Then check that Wrangler
// packages the Worker. Nothing is uploaded.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { gunzipSync } from "node:zlib";
import { publish } from "./publish.mjs";
import { memoryStore, r2Binding, memoryCache } from "./r2-memory.mjs";
import worker from "./worker/index.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const requireSite = createRequire(new URL("../site/package.json", import.meta.url));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "cyberjudah-data-assets-"));
const out = path.join(scratch, "dist");
const store = memoryStore();
globalThis.caches = { default: memoryCache() };
const get = (p, headers = {}) => worker.fetch(new Request(`https://data.cyberjudah.io${p}`, { headers }), { DATA: r2Binding(store) }, { waitUntil: (pr) => pr });
let published;

after(() => fs.rmSync(scratch, { recursive: true, force: true }));
before(async () => {
  execFileSync(process.execPath, ["engine/build.mjs", "--out", out, "--site", "https://cyberjudah.io", "--no-thumbs"], {
    cwd: root, stdio: "inherit", timeout: 300_000,
  });
  published = await publish(store, { dir: out, source: "0".repeat(40) });
});

test("every built file is published and live", async () => {
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(path.join(d, e.name)) : files.push(e); };
  walk(out);
  assert.equal(published.files, files.length);
  const ptr = await (await get("/pointer.json")).json();
  assert.equal(ptr.build, published.id);
});

test("the big downloads are served whole from the data origin", async () => {
  const sqlite = Buffer.from(await (await get("/library.sqlite.gz")).arrayBuffer());
  assert.ok(sqlite.equals(fs.readFileSync(path.join(out, "library.sqlite.gz"))));
  assert.equal(gunzipSync(sqlite).subarray(0, 16).toString(), "SQLite format 3\0");
  const sql = Buffer.from(await (await get("/search.sql.gz")).arrayBuffer());
  assert.match(gunzipSync(sql).subarray(0, 1 << 20).toString(), /search_docs/);
  const { parts } = await (await get("/search-index/parts.json")).json();
  assert.ok(parts.length > 0);
  for (const { file } of parts) assert.equal((await get(`/search-index/${file}`)).status, 200);
});

test("the JSON the front ends read is served", async () => {
  for (const p of ["/api/index.json", "/api/kjv/genesis/1.json", "/search/classes.json", "/manifest.json", "/llms.txt"])
    assert.equal((await get(p)).status, 200, p);
  const api = await (await get("/api/index.json")).json();
  assert.equal(api.search.sqlite, "/library.sqlite.gz");
  assert.equal(api.downloads.vault, "/downloads/vault.zip");
});

test("people and places are built from the KJV, with evidence and verses", async () => {
  const people = JSON.parse(fs.readFileSync(path.join(root, "data/people-kjv/people.json"))).people;
  const pick = (list) => list.map(({ id, verses }) => ({ id, verses })).sort((a, b) => a.id.localeCompare(b.id));
  const mattathias = await (await get("/api/people/mattathias-1ma-2-1.json")).json();
  assert.deepEqual(pick(mattathias.line), pick(people.find((p) => p.id === "mattathias-1ma-2-1").line));
  assert.deepEqual(mattathias.line.map((e) => [e.id, e.evidenceLabel]), [["jehoiarib-1ch-24-7", "Historically identified"]]);
  assert.ok(mattathias.line[0].sources.every((s) => s.url.startsWith("https://")));
  const jehoiarib = await (await get("/api/people/jehoiarib-1ch-24-7.json")).json();
  assert.ok(jehoiarib.descendants.some((e) => e.id === "mattathias-1ma-2-1"));
  const aaron = await (await get("/api/people/aaron-exo-4-14.json")).json();
  assert.equal(aaron.tribe, "Tribe of Levi");
  const judah = await (await get("/api/people/judah-gen-29-35.json")).json();
  assert.equal(judah.tribe, "Father of the tribe of Judah");
  const hagar = await (await get("/api/people/hagar-gen-16-1.json")).json();
  assert.ok(hagar.tribe && hagar.tribe === hagar.nation.map((n) => n.name).join(", "));
  const judas = await (await get("/api/people/judas-maccabeus-1ma-2-4.json")).json();
  assert.equal(judas.name, "Judas Maccabeus");
  assert.equal(judas.tribe, "Tribe of Levi");
  assert.deepEqual(aaron.father.map((e) => [e.id, e.evidenceLabel]), [["amram-exo-6-18", "Scripturally confirmed"]]);
  assert.equal(aaron.source.license, "Public domain");
  const havilah = await (await get("/api/places/havilah-gen-2-11.json")).json();
  assert.deepEqual(havilah.coords, [havilah.pin.lat, havilah.pin.lon]);
  assert.equal(havilah.pin.url, "https://www.wikidata.org/wiki/Q1591658");
  assert.doesNotMatch(JSON.stringify([aaron, havilah]), /STEPBible|TIPNR/);
});

test("the data Worker packages successfully without deploying", () => {
  const output = execFileSync(process.execPath, [
    path.join(path.dirname(requireSite.resolve("wrangler/package.json")), "bin/wrangler.js"), "deploy", "--dry-run",
    "--config", "engine/worker/wrangler.jsonc", "--outdir", path.join(scratch, "worker"),
  ], {
    cwd: root, encoding: "utf8", timeout: 120_000,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false", WRANGLER_LOG_PATH: path.join(scratch, "wrangler.log") },
  });
  assert.match(output, /env\.DATA \(cyberjudah-data\)/);
  assert.match(output, /--dry-run: exiting now/);
});
