#!/usr/bin/env node
/**
 * Loads a full-replace index (the search index, or the teachings index) into the site's D1
 * database (`cyberjudah`) blue-green: a spare copy is built beside the live tables with ordinary queries (no import, so the database is
 * never locked), checked, then switched in one step; the previous copy is kept for rollback.
 * bluegreen-load.mjs and d1-query.mjs are copies of the bot's (DevSecObie/cyberjudah-telegram,
 * bot/scripts/), which loads the same file into its own database.
 *
 *   node .github/scripts/load-search-d1.mjs dist/search.sql.gz [database] [search|teachings]
 */
import { createReadStream, openSync, readSync, closeSync, statSync } from "node:fs";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { bluegreenLoad, SEARCH, TEACHINGS } from "./bluegreen-load.mjs";
import { d1Query } from "./d1-query.mjs";

const [file = "dist/search.sql.gz", DB = "cyberjudah", kind = "search"] = process.argv.slice(2);
const KIND = { search: SEARCH, teachings: TEACHINGS }[kind];
if (!KIND) throw new Error(`unknown index ${kind}: search or teachings`);
const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account } = process.env;
if (!token || !account) throw new Error("CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are needed");
const api = `https://api.cloudflare.com/client/v4/accounts/${account}/d1/database`;
const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
const dbs = await fetch(`${api}?name=${encodeURIComponent(DB)}`, { headers }).then((r) => r.json());
const id = dbs.result?.find((d) => d.name === DB)?.uuid;
if (!id) throw new Error(`no D1 database named ${DB}`);
console.error(`${(statSync(file).size / 1e6).toFixed(1)} MB file into ${DB}`);
// Read line by line, opened once the load holds its lease: the teachings index is larger than a
// JavaScript string can hold.
const magic = Buffer.alloc(2);
const fd = openSync(file, "r"); readSync(fd, magic, 0, 2, 0); closeSync(fd);
const open = () => {
  const stream = createReadStream(file);
  return createInterface({ input: magic[0] === 0x1f && magic[1] === 0x8b ? stream.pipe(createGunzip()) : stream, crlfDelay: Infinity });
};
await bluegreenLoad(open, d1Query(`${api}/${id}/query`, headers), { ...KIND, log: (m) => console.error(m) });
