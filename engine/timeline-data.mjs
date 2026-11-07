import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export const TIMELINE_REPOSITORY = "DevSecObie/cyberjudah-telegram";
export const TIMELINE_PATH = "app/src/data/timeline.json";
export const TIMELINE_LICENSE_PATH = "app/scripts/timeline/bible-strong-LICENSE";
export const TIMELINE_CREDITS_PATH = "app/src/lib/credits.ts";
export const TIMELINE_CREDIT = { name: "Timeline layout and events", by: "Bible Strong", license: "GNU GPL v3", licenseUrl: "https://www.gnu.org/licenses/gpl-3.0.html" };
export const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

/** Validate the source's shape without rewriting, filtering, sorting or inventing any content. */
export function validateTimeline(bytes) {
  const doc = JSON.parse(bytes.toString("utf8"));
  if (typeof doc.source !== "string" || typeof doc.reigns !== "string" || !doc.finalCaptivity || typeof doc.finalCaptivity !== "object" || Array.isArray(doc.finalCaptivity) || !Array.isArray(doc.sections) || doc.sections.length !== 17)
    throw new Error("Timeline must contain its source, reigns, finalCaptivity and all 17 sections");
  for (const [i, section] of doc.sections.entries()) {
    if (!section || !Array.isArray(section.events) || (i < 12 ? section.id !== String(i + 1) : !/^fc-[a-z0-9-]+$/.test(section.id)))
      throw new Error(`Invalid Timeline section at index ${i}`);
  }
  if (new Set(doc.sections.map(s => s.id)).size !== 17) throw new Error("Duplicate Timeline section IDs");
  return doc;
}

/** The index is a byte-for-byte copy of the reviewed, commit-pinned upstream JSON. */
export function writeTimelineData(root, api) {
  const source = path.join(root, "data", "timeline");
  const bytes = fs.readFileSync(path.join(source, "timeline.json"));
  const license = fs.readFileSync(path.join(source, "bible-strong-LICENSE"));
  const provenance = JSON.parse(fs.readFileSync(path.join(source, "source.json"), "utf8"));
  if (provenance.version !== 1 || provenance.repository !== TIMELINE_REPOSITORY || provenance.path !== TIMELINE_PATH || !/^[a-f0-9]{40}$/.test(provenance.commit) || provenance.licensePath !== TIMELINE_LICENSE_PATH || provenance.creditsPath !== TIMELINE_CREDITS_PATH || !/^[a-f0-9]{64}$/.test(provenance.creditsSha256) || provenance.sha256 !== sha256(bytes) || provenance.licenseSha256 !== sha256(license))
    throw new Error("Timeline snapshot does not match its pinned source hashes");
  const doc = validateTimeline(bytes);
  const directory = path.join(api, "timeline");
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "index.json"), bytes);
  fs.writeFileSync(path.join(directory, "license.txt"), license);
  fs.writeFileSync(path.join(directory, "attribution.json"), JSON.stringify({
    ...provenance,
    source: doc.source, reigns: doc.reigns,
    attribution: { ...TIMELINE_CREDIT, sections: doc.sections.slice(0, 12).map(s => s.id), licenseFile: "/api/timeline/license.txt", source: "https://github.com/smontlouis/bible-strong" },
    sourceUrl: `https://github.com/${provenance.repository}/blob/${provenance.commit}/${provenance.path}`,
    correspondingSource: `https://github.com/${provenance.repository}/tree/${provenance.commit}`,
    creditsUrl: `https://github.com/${provenance.repository}/blob/${provenance.commit}/${provenance.creditsPath}`,
  }));
  return { sections: doc.sections.length, events: doc.sections.reduce((n, s) => n + s.events.length, 0), bytes: bytes.length };
}
