// Publishes a built data set (dist/) to the R2 bucket that data.cyberjudah.io serves from.
//
//   node engine/publish.mjs --dir dist --source <commit> [--keep 10]
//   node engine/publish.mjs --rollback <build-id>     point pointer.json at a kept older build
//
// 1. Hash every file. Upload only the objects the live build does not already hold (o/<sha256>),
//    so a new note uploads a handful of files, not the whole set.
// 2. Write the new build's manifest (builds/<id>/meta.json and its shards).
// 3. Go live: write pointer.json. Readers move from the old build to the new one in one step.
// 4. Tidy: drop builds older than the newest --keep, then any object none of the kept builds use.
// The layout is in worker/layout.mjs. No file size limit applies: R2 takes objects of up to 5 GB
// in one PUT. Credentials: see r2.mjs.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { SHARDS, shardOf, shardName } from "./worker/layout.mjs";

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const hashFile = (f) => createHash("sha256").update(fs.readFileSync(f)).digest("hex");

/** Run fn over items, `limit` at a time. */
async function pool(items, limit, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (i < items.length) { const n = i++; await fn(items[n], n); } }));
}

async function readJson(store, key) {
  const b = await store.get(key);
  return b ? JSON.parse(b.toString("utf8")) : null;
}

/** Every path → [hash, size] a build lists, read from its shards. */
async function buildFiles(store, id) {
  const files = new Map();
  await pool([...Array(SHARDS).keys()], 16, async (n) => {
    const shard = await readJson(store, `builds/${id}/${shardName(n)}.json`);
    for (const [p, v] of Object.entries(shard ?? {})) files.set(p, v);
  });
  return files;
}

export async function publish(store, { dir, source, keep = 10, now = new Date(), log = console.error, concurrency = 32, graceMs = 60 * 60 * 1000 }) {
  const t0 = Date.now();
  const built = now.toISOString();
  const id = `${built.replace(/[-:]|\.\d{3}/g, "")}-${String(source).slice(0, 12)}`;

  // 1. What this build holds, and what the bucket already has.
  const files = walk(dir).map((f) => path.relative(dir, f).split(path.sep).join("/")).filter((p) => p !== ".assetsignore" && p !== "_headers").sort();
  if (!files.length) throw new Error(`${dir} is empty`);
  const entries = new Map();
  for (const p of files) { const f = path.join(dir, p); entries.set(p, [hashFile(f), fs.statSync(f).size]); }
  const prev = await readJson(store, "pointer.json");
  const have = new Set();
  if (prev?.build) for (const [, [h]] of await buildFiles(store, prev.build)) have.add(h);
  const upload = new Map(); // hash -> a path with those bytes
  for (const [p, [h]] of entries) if (!have.has(h) && !upload.has(h)) upload.set(h, p);
  let bytes = 0;
  await pool([...upload], concurrency, async ([h, p]) => {
    const body = fs.readFileSync(path.join(dir, p));
    await store.put(`o/${h}`, body);
    bytes += body.length;
  });
  log(`publish: ${files.length} files, ${upload.size} new objects uploaded (${(bytes / 1048576).toFixed(1)} MB), ${entries.size - [...entries.values()].filter(([h]) => upload.has(h)).length} unchanged`);

  // 2. The manifest, sharded so the Worker reads a few KB to find any one path.
  const shards = Array.from({ length: SHARDS }, () => ({}));
  for (const [p, v] of entries) shards[shardOf(p)][p] = v;
  await pool(shards.map((s, n) => [s, n]), 16, ([s, n]) => store.put(`builds/${id}/${shardName(n)}.json`, Buffer.from(JSON.stringify(s)), "application/json"));
  const total = [...entries.values()].reduce((a, [, s]) => a + s, 0);
  await store.put(`builds/${id}/meta.json`, Buffer.from(JSON.stringify({ id, source, built, files: entries.size, bytes: total, shards: SHARDS })), "application/json");

  // 3. Live.
  const pointer = { build: id, commit: source, source, built };
  await store.put("pointer.json", Buffer.from(JSON.stringify(pointer) + "\n"), "application/json");
  log(`publish: live build ${id} (was ${prev?.build ?? "none"})`);

  // 4. Tidy. A build's objects are kept while any of the newest `keep` builds lists them; objects
  // younger than the grace period are left alone in case another publish is writing them now.
  const ids = [...new Set((await store.list("builds/")).map((o) => o.key.split("/")[1]))].sort();
  const keepIds = new Set(ids.slice(-keep));
  keepIds.add(id);
  const dropIds = ids.filter((b) => !keepIds.has(b));
  const used = new Set();
  for (const b of keepIds) for (const [, [h]] of b === id ? entries : await buildFiles(store, b)) used.add(h);
  const stale = [];
  for (const b of dropIds) for (const o of await store.list(`builds/${b}/`)) stale.push(o.key);
  const cutoff = now.getTime() - graceMs;
  for (const o of await store.list("o/")) if (!used.has(o.key.slice(2)) && Date.parse(o.modified) < cutoff) stale.push(o.key);
  await pool(stale, concurrency, (k) => store.del(k));
  log(`publish: kept ${keepIds.size} builds, removed ${dropIds.length} older builds and ${stale.length} stale keys · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return { id, uploaded: upload.size, files: entries.size, removed: stale.length, pointer };
}

/** Make an older, still-kept build live again. */
export async function rollback(store, id, log = console.error) {
  const meta = await readJson(store, `builds/${id}/meta.json`);
  if (!meta) throw new Error(`no build ${id} in the bucket (only the newest kept builds can be restored)`);
  const pointer = { build: meta.id, commit: meta.source, source: meta.source, built: meta.built };
  await store.put("pointer.json", Buffer.from(JSON.stringify(pointer) + "\n"), "application/json");
  log(`publish: live build is now ${meta.id} (built ${meta.built} from ${meta.source})`);
  return pointer;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
  if (opt("rollback")) {
    const { r2FromEnv } = await import("./r2.mjs");
    await rollback(r2FromEnv(), opt("rollback"));
    process.exit(0);
  }
  const dir = path.resolve(opt("dir", "dist"));
  const source = opt("source", process.env.GITHUB_SHA);
  if (!source) throw new Error("--source <commit> is required (or GITHUB_SHA)");
  const { r2FromEnv } = await import("./r2.mjs");
  await publish(r2FromEnv(), { dir, source, keep: Number(opt("keep", 10)) });
}
