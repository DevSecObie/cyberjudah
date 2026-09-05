// One-off migration over the committed class and captains notes.
//
//   node scripts/link-timestamps.mjs [--dry]
//
// Two fixes, both to the markdown source rather than the generator, because these notes are
// the source of record: the vault export and anyone reading the repo get the corrected text
// too, not just the built site.
//
//   1. The footer read "[Class Notes Index](/classes) | Transcript: [full session](<this page>)".
//      The transcript link pointed at the page it was printed on, on 91 of 92 class notes and
//      all 5 episodes. Where the note carries a video id the link now goes to the recording;
//      where it does not, the dead link is dropped rather than pointed somewhere invented.
//
//   2. Every scripture opened is stamped with the wall-clock time it was read, "*[18:01]*".
//      Those were plain text. With a video id in hand they become links into the recording at
//      that second, which turns each note into an index of its own class.
//
// Reruns are safe: an already-linked timestamp is skipped, and the footer is matched on its
// original shape only.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry");

const FEEDS = [
  { dir: path.join(ROOT, "blog"), index: "[Class Notes Index](/classes)", watch: "Watch the full session" },
  { dir: path.join(ROOT, "captains"), index: "[15 Minutes Index](/captains)", watch: "Watch the full episode" },
];

// "18:01" and "2:23:09". Wrapped in the italics the notes already use, and never already a link.
const STAMP = /\*\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]\*/g;
const seconds = (h, m, s) => (s === undefined ? +h * 60 + +m : +h * 3600 + +m * 60 + +s);
const watchUrl = (id, t) => `https://www.youtube.com/watch?v=${id}${t === undefined ? "" : `&t=${t}s`}`;

let files = 0, stamps = 0, footers = 0, noVideo = 0;

for (const feed of FEEDS) {
  if (!fs.existsSync(feed.dir)) continue;
  for (const year of fs.readdirSync(feed.dir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const name of fs.readdirSync(path.join(feed.dir, year.name)).filter((f) => f.endsWith(".md"))) {
      const file = path.join(feed.dir, year.name, name);
      const before = fs.readFileSync(file, "utf8");
      const videoId = /data-video-id="([\w-]{11})"/.exec(before)?.[1] ?? null;
      let after = before;

      // The footer, whichever feed it belongs to. The old link is replaced wholesale so a
      // rerun cannot match it twice.
      const footer = /^\[(?:Class Notes Index|15 Minutes Index)\]\([^)]*\) \| Transcript: \[full (?:session|episode)\]\([^)]*\)$/m;
      if (footer.test(after)) {
        after = after.replace(footer, videoId
          ? `${feed.index} · [${feed.watch} on YouTube ↗](${watchUrl(videoId)})`
          : feed.index);
        footers++;
        if (!videoId) noVideo++;
      }

      // Timestamps only become links where there is a recording to link into.
      if (videoId) {
        after = after.replace(STAMP, (whole, h, m, s) => {
          stamps++;
          return `*[[${h}:${m}${s === undefined ? "" : ":" + s}](${watchUrl(videoId, seconds(h, m, s))})]*`;
        });
      }

      if (after !== before) { files++; if (!DRY) fs.writeFileSync(file, after); }
    }
  }
}

console.error(`${DRY ? "[dry] " : ""}${files} notes rewritten · ${footers} footers fixed (${noVideo} with no recording, link dropped) · ${stamps} timestamps linked`);
