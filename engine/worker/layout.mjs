// How a published data set is laid out in the R2 bucket, shared by the publisher
// (engine/publish.mjs) and the Worker that serves data.cyberjudah.io (engine/worker/index.mjs).
//
//   o/<sha256>                    every file's bytes, stored once under its content hash
//   builds/<id>/meta.json         one build: {id, source, built, files, bytes, shards}
//   builds/<id>/<nn>.json         that build's paths, split into SHARDS files: {path: [sha256, size]}
//   pointer.json                  which build is live: {build, commit, source, built}
//
// A build only uploads the objects the bucket does not already hold, and going live is one
// write of pointer.json, so a reader never sees half of one build and half of another, and
// rolling back is pointing at an older build.

export const SHARDS = 64;

/** FNV-1a over the path's UTF-16 code units: which manifest shard lists this path. */
export function shardOf(p) {
  let h = 0x811c9dc5;
  for (let i = 0; i < p.length; i++) { h ^= p.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) % SHARDS;
}
export const shardName = (n) => String(n).padStart(2, "0");

const TYPES = {
  json: "application/json; charset=utf-8", js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8", html: "text/html; charset=utf-8", txt: "text/plain; charset=utf-8", md: "text/markdown; charset=utf-8",
  xml: "application/xml; charset=utf-8", csv: "text/csv; charset=utf-8", tsv: "text/tab-separated-values; charset=utf-8",
  svg: "image/svg+xml", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif", ico: "image/x-icon",
  pdf: "application/pdf", zip: "application/zip", gz: "application/gzip", wasm: "application/wasm",
  mp3: "audio/mpeg", m4a: "audio/mp4", ogg: "audio/ogg", mp4: "video/mp4", vtt: "text/vtt; charset=utf-8",
  woff: "font/woff", woff2: "font/woff2",
};
export function contentType(p) {
  const ext = p.slice(p.lastIndexOf("/") + 1).split(".").pop().toLowerCase();
  return TYPES[ext] ?? "application/octet-stream";
}

/** The cache lifetime for a path: the rules the old dist/_headers file carried. */
export function cacheControl(p) {
  if (p === "pointer.json" || p === "manifest.json") return "public, max-age=60";
  if (p.startsWith("pagefind/")) return "public, max-age=86400";
  if (p.startsWith("img/")) return "public, max-age=604800";
  if (p === "library.sqlite.gz" || p === "search.sql.gz" || p.startsWith("search-index/")) return "public, max-age=3600";
  return "public, max-age=300";
}
