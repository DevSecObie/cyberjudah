// An in-memory bucket for tests: the publisher's store interface (get, put, del, list, as r2.mjs
// gives) and a view of the same objects shaped like the Worker's R2 binding (env.DATA).

export function memoryStore() {
  const objects = new Map(); // key -> { body: Buffer, modified: Date }
  const counts = { put: 0, del: 0 };
  return {
    objects, counts,
    async get(key) { return objects.get(key)?.body ?? null; },
    async put(key, body) { counts.put++; objects.set(key, { body: Buffer.from(body), modified: new Date(0) }); },
    async del(key) { counts.del++; objects.delete(key); },
    async list(prefix) {
      return [...objects].filter(([k]) => k.startsWith(prefix)).sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, o]) => ({ key, size: o.body.length, modified: o.modified.toISOString() }));
    },
  };
}

/** The R2 binding's get(), enough of it for the Worker: whole objects and `bytes=` ranges. */
export function r2Binding(store) {
  return {
    async get(key, opts = {}) {
      const o = store.objects.get(key);
      if (!o) return null;
      let body = o.body, range;
      const header = opts.range instanceof Headers ? opts.range.get("range") : null;
      const m = header && /^bytes=(\d*)-(\d*)$/.exec(header);
      if (m) {
        const size = o.body.length;
        const offset = m[1] === "" ? size - Number(m[2]) : Number(m[1]);
        const end = m[1] === "" || m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
        body = o.body.subarray(offset, end + 1);
        range = { offset, length: body.length };
      }
      return {
        range,
        body: new Response(body).body,
        async json() { return JSON.parse(o.body.toString("utf8")); },
      };
    },
  };
}

/** A stand-in for caches.default that remembers what was put. */
export function memoryCache() {
  const entries = new Map();
  return {
    entries,
    async match(req) { const b = entries.get(typeof req === "string" ? req : req.url); return b ? new Response(b) : undefined; },
    async put(req, res) { entries.set(typeof req === "string" ? req : req.url, Buffer.from(await res.arrayBuffer())); },
  };
}
