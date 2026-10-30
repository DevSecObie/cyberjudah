// The publisher and the data Worker against an in-memory bucket, on a small fixture data set.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { publish, rollback } from "./publish.mjs";
import { sign, r2 } from "./r2.mjs";
import { memoryStore, r2Binding, memoryCache } from "./r2-memory.mjs";
import worker, { forget } from "./worker/index.mjs";

const quiet = () => {};
let dir, store, cache;
const write = (p, s) => { fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true }); fs.writeFileSync(path.join(dir, p), s); };
const big = Buffer.alloc(30 * 1048576, 7); // over the 25 MiB a Workers static asset may be

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "cyberjudah-publish-"));
  write("api/index.json", '{"a":1}');
  write("api/kjv/genesis/1.json", '{"verses":[]}');
  write("img/x.webp", "img");
  write("library.sqlite.gz", big);
  write("search-index/01.sql.gz", "part");
  store = memoryStore();
  cache = memoryCache();
  globalThis.caches = { default: cache };
});

const get = async (p, headers = {}, method = "GET") => {
  forget();
  const ctx = { waitUntil: (pr) => pr };
  return worker.fetch(new Request(`https://data.cyberjudah.io${p}`, { method, headers }), { DATA: r2Binding(store) }, ctx);
};
const at = (min) => new Date(Date.UTC(2026, 9, 22, 4, min));

test("a first publish uploads every file once and goes live", async () => {
  write("api/copy.json", '{"a":1}'); // same bytes as api/index.json: one object
  const r = await publish(store, { dir, source: "a".repeat(40), now: at(0), log: quiet });
  assert.equal(r.files, 6);
  assert.equal(r.uploaded, 5);
  const ptr = JSON.parse((await store.get("pointer.json")).toString());
  assert.equal(ptr.build, r.id);
  assert.equal(ptr.source, "a".repeat(40));
  assert.ok(store.objects.has(`builds/${r.id}/meta.json`));
});

test("a later publish uploads only what changed", async () => {
  await publish(store, { dir, source: "a".repeat(40), now: at(0), log: quiet });
  write("api/kjv/genesis/1.json", '{"verses":[1]}');
  const r = await publish(store, { dir, source: "b".repeat(40), now: at(1), log: quiet });
  assert.equal(r.uploaded, 1);
  const res = await get("/api/kjv/genesis/1.json");
  assert.equal(await res.text(), '{"verses":[1]}');
});

test("the Worker serves files of any size with CORS, types, cache lifetimes and ETags", async () => {
  await publish(store, { dir, source: "a".repeat(40), now: at(0), log: quiet });
  const json = await get("/api/index.json");
  assert.equal(json.status, 200);
  assert.equal(json.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(json.headers.get("access-control-allow-origin"), "*");
  assert.equal(json.headers.get("x-content-type-options"), "nosniff");
  assert.equal(json.headers.get("cache-control"), "public, max-age=300");
  assert.equal(await json.text(), '{"a":1}');
  assert.equal((await get("/img/x.webp")).headers.get("cache-control"), "public, max-age=604800");

  const sqlite = await get("/library.sqlite.gz");
  assert.equal(sqlite.status, 200);
  assert.equal(sqlite.headers.get("content-type"), "application/gzip");
  assert.equal(sqlite.headers.get("content-length"), String(big.length));
  assert.ok(Buffer.from(await sqlite.arrayBuffer()).equals(big));

  const head = await get("/library.sqlite.gz", {}, "HEAD");
  assert.equal(head.headers.get("content-length"), String(big.length));
  assert.equal(await head.text(), "");

  const part = await get("/library.sqlite.gz", { range: "bytes=10-19" });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get("content-range"), `bytes 10-19/${big.length}`);
  assert.equal((await part.arrayBuffer()).byteLength, 10);

  // The same library for a phone to keep: the gzipped bytes, marked as gzip so the download unpacks them.
  const phone = await get("/library.sqlite");
  assert.equal(phone.status, 200);
  assert.equal(phone.headers.get("content-type"), "application/vnd.sqlite3");
  assert.equal(phone.headers.get("content-encoding"), "gzip");
  assert.equal(phone.headers.get("content-length"), String(big.length));
  assert.equal(phone.headers.get("cache-control"), "public, max-age=3600");
  assert.equal(phone.headers.get("etag"), sqlite.headers.get("etag"));
  assert.ok(Buffer.from(await phone.arrayBuffer()).equals(big));
  assert.equal((await get("/library.sqlite", { range: "bytes=10-19" })).status, 200);

  const etag = json.headers.get("etag");
  assert.equal((await get("/api/index.json", { "if-none-match": etag })).status, 304);

  const ptr = await get("/pointer.json");
  assert.equal(ptr.headers.get("cache-control"), "public, max-age=60");
  assert.equal((await ptr.json()).source, "a".repeat(40));
});

test("the Worker refuses what is not in the live build", async () => {
  await publish(store, { dir, source: "a".repeat(40), now: at(0), log: quiet });
  assert.equal((await get("/")).status, 404);
  assert.equal((await get("/nope.json")).status, 404);
  assert.equal((await get("/api/..%2fpointer.json")).status, 404);
  assert.equal((await get("/builds/x/meta.json")).status, 404);
  assert.equal((await get("/api/index.json", {}, "POST")).status, 405);
});

test("the Worker answers 503 before anything is published", async () => {
  assert.equal((await get("/api/index.json")).status, 503);
});

test("old builds and the objects only they used are removed", async () => {
  const first = await publish(store, { dir, source: "a".repeat(40), now: at(0), log: quiet, keep: 2, graceMs: 0 });
  write("api/kjv/genesis/1.json", '{"v":2}');
  await publish(store, { dir, source: "b".repeat(40), now: at(1), log: quiet, keep: 2, graceMs: 0 });
  write("api/kjv/genesis/1.json", '{"v":3}');
  const third = await publish(store, { dir, source: "c".repeat(40), now: at(2), log: quiet, keep: 2, graceMs: 0 });
  assert.equal((await store.list(`builds/${first.id}/`)).length, 0);
  assert.equal((await store.list("builds/")).filter((o) => o.key.endsWith("/meta.json")).length, 2);
  // Six distinct objects stay: five shared files, genesis v2 (second build), genesis v3 (third). v1 is gone.
  assert.equal((await store.list("o/")).length, 6);
  assert.equal(await (await get("/api/kjv/genesis/1.json")).text(), '{"v":3}');
  assert.equal(third.removed > 0, true);
});

test("a rollback makes an older build live again", async () => {
  const first = await publish(store, { dir, source: "a".repeat(40), now: at(0), log: quiet });
  write("api/index.json", '{"a":2}');
  await publish(store, { dir, source: "b".repeat(40), now: at(1), log: quiet });
  assert.equal(await (await get("/api/index.json")).text(), '{"a":2}');
  await rollback(store, first.id, quiet);
  assert.equal(await (await get("/api/index.json")).text(), '{"a":1}');
  await assert.rejects(rollback(store, "nope", quiet), /no build nope/);
});

test("R2 requests are signed exactly as AWS documents SigV4 (GET Object example)", () => {
  const h = sign({
    method: "GET", path: "/test.txt", headers: { host: "examplebucket.s3.amazonaws.com", range: "bytes=0-9" },
    payload: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    region: "us-east-1", date: new Date("2013-05-24T00:00:00Z"),
  });
  assert.equal(h.authorization, "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41");
});

test("the R2 client lists every page of a prefix and signs each call", async () => {
  const seen = [];
  const pages = [
    "<ListBucketResult><Contents><Key>o/a&amp;b</Key><Size>3</Size><LastModified>2026-10-22T00:00:00.000Z</LastModified></Contents><IsTruncated>true</IsTruncated><NextContinuationToken>t+1</NextContinuationToken></ListBucketResult>",
    "<ListBucketResult><Contents><Key>o/c</Key><Size>5</Size><LastModified>2026-10-22T00:00:01.000Z</LastModified></Contents><IsTruncated>false</IsTruncated></ListBucketResult>",
  ];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => { seen.push({ url, auth: init.headers.authorization }); return new Response(pages[seen.length - 1]); };
  try {
    const client = r2({ accessKeyId: "k", secretAccessKey: "s", endpoint: "https://acct.r2.cloudflarestorage.com", bucket: "cyberjudah-data" });
    const all = await client.list("o/");
    assert.deepEqual(all.map((o) => [o.key, o.size]), [["o/a&b", 3], ["o/c", 5]]);
    assert.equal(seen[0].url, "https://acct.r2.cloudflarestorage.com/cyberjudah-data?list-type=2&max-keys=1000&prefix=o%2F");
    assert.match(seen[1].url, /continuation-token=t%2B1/);
    for (const { auth } of seen) assert.match(auth, /^AWS4-HMAC-SHA256 Credential=k\/\d{8}\/auto\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/);
  } finally {
    globalThis.fetch = real;
  }
});
