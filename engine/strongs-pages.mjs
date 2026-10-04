import { createHash } from "node:crypto";

/** Keep the original first 600 results for older readers and publish every remaining
 * occurrence in immutable, revision-pinned pages. No occurrence is discarded. */
export function strongsPages(number, occurrences, pageSize = 600) {
  if (!/^[HG][1-9]\d*$/.test(number) || !Number.isSafeInteger(pageSize) || pageSize < 1) throw new Error("Invalid concordance pagination");
  const revision = createHash("sha256").update(JSON.stringify(occurrences)).digest("hex");
  const pages = Array.from({ length: Math.max(1, Math.ceil(occurrences.length / pageSize)) }, (_, page) => ({
    number, revision, page, total: occurrences.length,
    occurrences: occurrences.slice(page * pageSize, (page + 1) * pageSize),
    nextPage: (page + 1) * pageSize < occurrences.length ? page + 1 : null,
  }));
  return { revision, pageSize, pages };
}
