import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { writeTimelineData, sha256, TIMELINE_CREDIT } from "./timeline-data.mjs";
import { syncTimeline, checkTimelineSnapshot } from "../scripts/timeline/sync.mjs";
import { publish } from "./publish.mjs";
import { memoryStore, r2Binding, memoryCache } from "./r2-memory.mjs";
import worker, { forget } from "./worker/index.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = fs.readFileSync(new URL("../data/timeline/timeline.json", import.meta.url));
const license = fs.readFileSync(new URL("../data/timeline/bible-strong-LICENSE", import.meta.url));
const document = JSON.parse(source);
const fixture = t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cyberjudah-timeline-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};

test("the published Timeline keeps every source byte, section and event without rewriting JSON", t => {
  const api = path.join(fixture(t), "api");
  const counts = writeTimelineData(root, api);
  const bytes = fs.readFileSync(path.join(api, "timeline", "index.json"));
  assert.ok(bytes.equals(source), "including original whitespace, Unicode and the final newline");
  assert.deepEqual(JSON.parse(bytes), document);
  assert.equal(counts.sections, 17);
  assert.equal(counts.events, document.sections.reduce((n, s) => n + s.events.length, 0));
  assert.deepEqual(Object.keys(JSON.parse(bytes)), ["source", "reigns", "sections", "finalCaptivity"]);
  assert.deepEqual(fs.readdirSync(path.join(api, "timeline")).sort(), ["attribution.json", "index.json", "license.txt"]);
});

test("source or licence drift and missing periods fail the data build closed", t => {
  for (const change of ["source bytes", "licence bytes", "missing section", "duplicate section"]) {
    const dir = fixture(t), snapshot = path.join(dir, "data", "timeline");
    fs.cpSync(path.join(root, "data", "timeline"), snapshot, { recursive: true });
    if (change === "source bytes") fs.appendFileSync(path.join(snapshot, "timeline.json"), " ");
    else if (change === "licence bytes") fs.appendFileSync(path.join(snapshot, "bible-strong-LICENSE"), " ");
    else {
      const changed = structuredClone(document);
      if (change === "missing section") changed.sections.pop();
      else changed.sections[16].id = changed.sections[15].id;
      const bytes = Buffer.from(JSON.stringify(changed));
      fs.writeFileSync(path.join(snapshot, "timeline.json"), bytes);
      const provenance = JSON.parse(fs.readFileSync(path.join(snapshot, "source.json")));
      provenance.sha256 = sha256(bytes);
      fs.writeFileSync(path.join(snapshot, "source.json"), JSON.stringify(provenance));
    }
    assert.throws(() => writeTimelineData(dir, path.join(dir, "api")), /Timeline/, change);
    assert.equal(fs.existsSync(path.join(dir, "api", "timeline", "index.json")), false);
  }
});

test("the public data Worker serves exact Timeline JSON and GPL attribution with normal CORS/cache/ETag headers", async t => {
  const dir = fixture(t);
  writeTimelineData(root, path.join(dir, "api"));
  const store = memoryStore();
  globalThis.caches = { default: memoryCache() }; forget();
  await publish(store, { dir, source: "0".repeat(40), log: () => {} });
  const get = (pathname, init) => worker.fetch(new Request(`https://data.cyberjudah.io${pathname}`, init), { DATA: r2Binding(store) }, { waitUntil: p => p });
  const response = await get("/api/timeline/index.json");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.equal(response.headers.get("cache-control"), "public, max-age=300");
  assert.ok(Buffer.from(await response.arrayBuffer()).equals(source));
  assert.equal((await get("/api/timeline/index.json", { headers: { "if-none-match": response.headers.get("etag") } })).status, 304);
  assert.equal((await get("/api/timeline/index.json", { method: "OPTIONS" })).status, 204);
  const head = await get("/api/timeline/index.json", { method: "HEAD" });
  assert.equal(head.headers.get("content-length"), String(source.length)); assert.equal(await head.text(), "");
  const attribution = await (await get("/api/timeline/attribution.json")).json();
  for (const [key, value] of Object.entries(TIMELINE_CREDIT)) assert.equal(attribution.attribution[key], value);
  assert.deepEqual(attribution.attribution.sections, document.sections.slice(0, 12).map(s => s.id));
  assert.equal(attribution.sha256, sha256(source));
  assert.equal(attribution.source, document.source); assert.equal(attribution.reigns, document.reigns);
  assert.match(attribution.correspondingSource, /\/tree\/[a-f0-9]{40}$/);
  assert.ok(Buffer.from(await (await get(attribution.attribution.licenseFile)).arrayBuffer()).equals(license));
});

test("refreshing a snapshot requires an immutable commit from the correct source repository", t => {
  const destination = path.join(fixture(t), "snapshot");
  assert.throws(() => syncTimeline({ repo: root, ref: "main", destination }), /40-character commit/);
  assert.throws(() => syncTimeline({ repo: root, ref: "0".repeat(40), destination }), /source checkout must be/);
  assert.equal(fs.existsSync(destination), false);
});

test("checking Telegram main detects content drift but permits unrelated commits and credits edits", t => {
  const dir = fixture(t);
  fs.cpSync(path.join(root, "data/timeline"), dir, { recursive: true });
  const pinned = JSON.parse(fs.readFileSync(path.join(dir, "source.json")));
  const incoming = { ...pinned, commit: "f".repeat(40), creditsSha256: "e".repeat(64) };
  assert.deepEqual(checkTimelineSnapshot(dir, source, license, incoming), pinned);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, "source.json"))), pinned, "checking never changes the reviewed pin");
  assert.throws(() => checkTimelineSnapshot(dir, Buffer.concat([source, Buffer.from(" ")]), license, incoming), /timeline.json/);
  assert.throws(() => checkTimelineSnapshot(dir, source, Buffer.concat([license, Buffer.from(" ")]), incoming), /bible-strong-LICENSE/);
});

test("the scheduled drift check warns and fails on mismatch without publishing or refreshing the snapshot", t => {
  const workflow = fs.readFileSync(path.join(root, ".github/workflows/timeline-sync.yml"), "utf8");
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.match(workflow, /repository: DevSecObie\/cyberjudah-telegram\n          ref: main/);
  const script = workflow.split("        run: |\n")[1].split("\n").map(line => line.replace(/^          /, "")).join("\n");
  const dir = fixture(t), bin = path.join(dir, "bin"); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "git"), '#!/bin/sh\nprintf "%s\\n" ffffffffffffffffffffffffffffffffffffffff\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, "node"), '#!/bin/sh\nexit "$CHECK_RC"\n', { mode: 0o755 });
  for (const code of [0, 1]) {
    const summary = path.join(dir, `summary-${code}`);
    const result = spawnSync("bash", ["-e", "-c", script], { encoding: "utf8", env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, CHECK_RC: String(code), TIMELINE_REPO: dir, GITHUB_STEP_SUMMARY: summary } });
    assert.equal(result.status, code);
    assert.equal(result.stdout.includes("::warning"), code === 1);
    assert.match(fs.readFileSync(summary, "utf8"), /no publication|does not publish/);
  }
  assert.doesNotMatch(script, /publish\.mjs|wrangler|git (?:push|commit)/);
  assert.match(script, /--check/);
});
