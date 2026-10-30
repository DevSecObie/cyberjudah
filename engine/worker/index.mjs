// data.cyberjudah.io: serves the live build of the data set out of the R2 bucket bound as DATA.
// The layout is in layout.mjs. Every file is public, read-only and CORS-open; nothing here
// writes to the bucket.
import { SHARDS, shardOf, shardName, contentType, cacheControl } from "./layout.mjs";

const POINTER_TTL = 30_000;
let pointer = null; // { value, at }
const shards = new Map(); // `${build}/${nn}` -> {path: [hash, size]}, immutable once written
/** Tests only: forget the cached pointer and shards. */
export function forget() { pointer = null; shards.clear(); }

async function live(env) {
  if (pointer && Date.now() - pointer.at < POINTER_TTL) return pointer.value;
  const obj = await env.DATA.get("pointer.json");
  if (!obj) return null;
  const value = await obj.json();
  pointer = { value, at: Date.now() };
  return value;
}

async function lookup(env, build, p) {
  const key = `${build}/${shardName(shardOf(p))}`;
  let shard = shards.get(key);
  if (!shard) {
    const obj = await env.DATA.get(`builds/${key}.json`);
    if (!obj) return null;
    shard = await obj.json();
    // A build's shards never change; keep the most recent few hundred in this isolate.
    if (shards.size >= SHARDS * 4) shards.delete(shards.keys().next().value);
    shards.set(key, shard);
  }
  return shard[p] ?? null;
}

// The library for a phone to keep (the app's on-device search): the published gzipped copy,
// sent with Content-Encoding: gzip so the phone's download unpacks it on the way in. One object
// in the bucket serves both paths.
const ENCODED = { "library.sqlite": "library.sqlite.gz" };

const base = (p) => ({
  "access-control-allow-origin": "*",
  "x-content-type-options": "nosniff",
  "cache-control": cacheControl(p),
});
const status = (code, p = "") => new Response(code === 404 ? "Not found" : null, { status: code, headers: { ...base(p), "content-type": "text/plain; charset=utf-8" } });

export default {
  async fetch(request, env, ctx) {
    const method = request.method;
    if (method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, HEAD, OPTIONS", "access-control-allow-headers": "*", "access-control-max-age": "86400" } });
    if (method !== "GET" && method !== "HEAD") return new Response(null, { status: 405, headers: { allow: "GET, HEAD, OPTIONS" } });
    const url = new URL(request.url);
    let p;
    try { p = decodeURIComponent(url.pathname).replace(/^\/+/, ""); } catch { return status(400); }
    if (!p || p.split("/").some((s) => s === ".." || s === ".")) return status(404);

    const ptr = await live(env);
    if (!ptr) return status(503);
    if (p === "pointer.json") {
      return new Response(method === "HEAD" ? null : JSON.stringify(ptr) + "\n", { headers: { ...base(p), "content-type": contentType(p) } });
    }
    const stored = ENCODED[p];
    const entry = await lookup(env, ptr.build, stored ?? p);
    if (!entry) return status(404, p);
    const [hash, size] = entry;
    const etag = `"${hash}"`;
    const headers = stored
      ? { ...base(p), "content-type": contentType(p), etag, "content-encoding": "gzip" }
      : { ...base(p), "content-type": contentType(p), etag, "accept-ranges": "bytes" };
    // Workers would otherwise compress the already gzipped bytes again.
    const init = stored ? { encodeBody: "manual" } : {};

    const inm = request.headers.get("if-none-match");
    if (inm && inm.split(",").some((t) => t.trim().replace(/^W\//, "") === etag)) return new Response(null, { status: 304, headers });
    if (method === "HEAD") return new Response(null, { headers: { ...headers, "content-length": String(size) } });

    const range = stored ? null : request.headers.get("range");
    if (range) {
      const obj = await env.DATA.get(`o/${hash}`, { range: request.headers });
      if (!obj) return status(404, p);
      if (!obj.range || !("offset" in obj.range)) return new Response(obj.body, { headers: { ...headers, "content-length": String(size) } });
      const { offset, length } = obj.range;
      return new Response(obj.body, { status: 206, headers: { ...headers, "content-length": String(length), "content-range": `bytes ${offset}-${offset + length - 1}/${size}` } });
    }

    // Whole objects are held in this data centre's cache under their hash: the same bytes are
    // the same file whatever path or build names them, so the cached copy never goes stale.
    const cache = caches.default;
    const cacheKey = new Request(`${url.origin}/__o/${hash}`);
    let body = (await cache.match(cacheKey))?.body;
    if (!body) {
      const obj = await env.DATA.get(`o/${hash}`);
      if (!obj) return status(404, p);
      if (size <= 100 * 1048576) {
        const [a, b] = obj.body.tee();
        ctx.waitUntil(cache.put(cacheKey, new Response(b, { headers: { "cache-control": "public, max-age=31536000, immutable", "content-length": String(size) } })));
        body = a;
      } else body = obj.body;
    }
    return new Response(body, { ...init, headers: { ...headers, "content-length": String(size) } });
  },
};
