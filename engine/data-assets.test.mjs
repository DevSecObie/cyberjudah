import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { gunzipSync } from "node:zlib";

const root = fileURLToPath(new URL("..", import.meta.url));
const requireSite = createRequire(new URL("../site/package.json", import.meta.url));
const { buildAssetManifest } = requireSite("miniflare");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "cyberjudah-data-assets-"));
const out = path.join(scratch, "dist");
const sqliteUrl = "https://raw.githubusercontent.com/DevSecObie/cyberjudah/data/library.sqlite.gz";
const read = (name) => fs.readFileSync(path.join(out, name));

after(() => fs.rmSync(scratch, { recursive: true, force: true }));
before(() => {
  execFileSync(process.execPath, ["engine/build.mjs", "--out", out, "--site", "https://cyberjudah.io", "--no-thumbs"], {
    cwd: root, stdio: "inherit", timeout: 240_000,
  });
});

test("the GitHub publication retains the offline database and D1 import", () => {
  assert.equal(gunzipSync(read("library.sqlite.gz")).subarray(0, 16).toString(), "SQLite format 3\0");
  assert.match(gunzipSync(read("search.sql.gz")).toString(), /CREATE VIRTUAL TABLE search_docs USING fts5/);
  // The data workflow publishes the entire output with git add -A. An assets exclusion
  // must not become a git exclusion or remove either download from this publication.
  const git = (...args) => execFileSync("git", args, { cwd: out, encoding: "utf8" });
  try {
    git("init", "-q");
    git("add", "-A");
    const published = git("ls-files").split("\n");
    for (const file of ["library.sqlite.gz", "search.sql.gz", ".assetsignore", "api/index.json", "search-index/parts.json"])
      assert.ok(published.includes(file), `${file} must remain in the data branch`);
  } finally {
    fs.rmSync(path.join(out, ".git"), { recursive: true, force: true });
  }
});

test("Cloudflare excludes SQLite at any size and keeps the other data assets", async () => {
  // Also protect against a future build retaining the uncompressed database.
  const raw = path.join(out, "library.sqlite");
  fs.writeFileSync(raw, "SQLite format 3\0");
  try {
    const { assetsReverseMap } = await buildAssetManifest(out);
    const assets = new Set(Object.values(assetsReverseMap).map(({ filePath }) => filePath.split(path.sep).join("/")));
    for (const file of ["library.sqlite", "library.sqlite.gz", "search.sql.gz"])
      assert.ok(!assets.has(file), `${file} must never be a Cloudflare asset`);
    for (const file of ["api/index.json", "api/kjv/genesis/1.json", "search/classes.json", "pagefind/pagefind.js", "search-index/parts.json"])
      assert.ok(assets.has(file), `${file} must still be served by Cloudflare`);
    const { parts } = JSON.parse(read("search-index/parts.json"));
    assert.ok(parts.length > 0);
    for (const { file } of parts) assert.ok(assets.has(`search-index/${file}`));
    if (fs.existsSync(path.join(out, "downloads/vault.zip"))) assert.ok(assets.has("downloads/vault.zip"));
    assert.ok(fs.existsSync(path.join(out, "library.sqlite.gz")), "packaging must not delete the GitHub download");
  } finally {
    fs.rmSync(raw);
  }
});

test("generated SQLite download references point directly to GitHub", () => {
  const api = JSON.parse(read("api/index.json"));
  assert.equal(api.search.sqlite, sqliteUrl);
  assert.equal(api.downloads.vault, "/downloads/vault.zip");
  assert.ok(read("llms.txt").toString().includes(`](${sqliteUrl})`));
});

test("the data Worker packages successfully without deploying", () => {
  const output = execFileSync(process.execPath, [
    path.join(path.dirname(requireSite.resolve("wrangler/package.json")), "bin/wrangler.js"), "deploy", "--dry-run",
    "--config", "engine/worker/wrangler.jsonc", "--assets", out,
    "--outdir", path.join(scratch, "worker"),
  ], {
    cwd: root, encoding: "utf8", timeout: 120_000,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false", WRANGLER_LOG_PATH: path.join(scratch, "wrangler.log") },
  });
  assert.match(output, /--dry-run: exiting now/);
});
