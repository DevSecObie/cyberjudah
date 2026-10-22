// A small S3 client for one R2 bucket (SigV4 over fetch, no dependencies), with the four calls
// the publisher needs: get, put, delete and list. Credentials come from the environment:
// R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT (https://<account>.r2.cloudflarestorage.com)
// and R2_BUCKET_NAME. Keys scoped to the one bucket, Object Read & Write, are all it needs.
import { createHash, createHmac } from "node:crypto";

const sha256 = (b) => createHash("sha256").update(b).digest("hex");
const hmac = (k, s) => createHmac("sha256", k).update(s).digest();
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** SigV4: the request's headers with x-amz-date, x-amz-content-sha256 and authorization added. */
export function sign({ method, path, qs = "", headers, payload, accessKeyId, secretAccessKey, region = "auto", date = new Date() }) {
  const now = date.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const day = now.slice(0, 8);
  const h = { ...headers, "x-amz-content-sha256": payload, "x-amz-date": now };
  const lower = Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), String(v).trim()]));
  const names = Object.keys(lower).sort();
  const canon = [method, path, qs, names.map((k) => `${k}:${lower[k]}\n`).join(""), names.join(";"), payload].join("\n");
  const scope = `${day}/${region}/s3/aws4_request`;
  const sts = ["AWS4-HMAC-SHA256", now, scope, sha256(canon)].join("\n");
  const key = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, day), region), "s3"), "aws4_request");
  const sig = createHmac("sha256", key).update(sts).digest("hex");
  return { ...h, authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${names.join(";")}, Signature=${sig}` };
}

export function r2FromEnv(env = process.env) {
  for (const k of ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ENDPOINT", "R2_BUCKET_NAME"])
    if (!env[k]) throw new Error(`${k} is not set`);
  return r2({ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, endpoint: env.R2_ENDPOINT, bucket: env.R2_BUCKET_NAME });
}

export function r2({ accessKeyId, secretAccessKey, endpoint, bucket }) {
  const host = new URL(endpoint).host;
  async function call(method, key, { query = {}, body = null, headers = {}, ok = [200] } = {}) {
    const path = `/${bucket}${key === null ? "" : "/" + key.split("/").map(enc).join("/")}`;
    const qs = Object.keys(query).sort().map((k) => `${enc(k)}=${enc(query[k])}`).join("&");
    const h = sign({ method, path, qs, headers: { host, ...headers }, payload: sha256(body ?? ""), accessKeyId, secretAccessKey });
    delete h.host;
    for (let attempt = 1; ; attempt++) {
      let res;
      try {
        res = await fetch(`${endpoint}${path}${qs ? "?" + qs : ""}`, { method, headers: h, body });
      } catch (e) {
        if (attempt < 5) { await new Promise((r) => setTimeout(r, 500 * 2 ** attempt)); continue; }
        throw e;
      }
      if (ok.includes(res.status)) return res;
      const text = await res.text();
      if ((res.status >= 500 || res.status === 429) && attempt < 5) { await new Promise((r) => setTimeout(r, 500 * 2 ** attempt)); continue; }
      throw new Error(`R2 ${method} ${key ?? ""}: ${res.status} ${text.slice(0, 300)}`);
    }
  }
  return {
    /** The object's bytes, or null when it is not there. */
    async get(key) {
      const res = await call("GET", key, { ok: [200, 404] });
      return res.status === 404 ? null : Buffer.from(await res.arrayBuffer());
    },
    async put(key, body, contentType = "application/octet-stream") {
      await call("PUT", key, { body, headers: { "content-type": contentType } });
    },
    async del(key) {
      await call("DELETE", key, { ok: [200, 204, 404] });
    },
    /** Every object under a prefix: [{key, size, modified}]. */
    async list(prefix) {
      const out = [];
      let token = null;
      do {
        const query = { "list-type": "2", "max-keys": "1000", prefix };
        if (token) query["continuation-token"] = token;
        const xml = await (await call("GET", null, { query })).text();
        for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
          const tag = (t) => m[1].match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`))?.[1];
          out.push({ key: unxml(tag("Key")), size: Number(tag("Size")), modified: tag("LastModified") });
        }
        token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? unxml(xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] ?? "") : null;
      } while (token);
      return out;
    },
  };
}
const unxml = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
