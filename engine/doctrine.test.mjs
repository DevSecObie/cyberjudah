import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blockRef, loadDoctrine, resolveDoctrine, splitRef } from "./doctrine.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const pass = {
  video: "abcdefghijk", title: "A class", date: "2026-01-01", teacher: "Bishop Nathanyel",
  passages: [
    { opened: "Micah 5:3", ts: "10:00", teacher: "", sense: [], precepts: [{ ref: "1 Kings 14:15-16", why: "First." }] },
    { opened: "Micah 5:3", ts: "1:16:38", teacher: "Deacon Eythan", sense: [{ at: "3", text: "One.\n\nTwo." }], precepts: [{ ref: "Hosea 1:10-11", why: "Gathered.\n\nOnly Israel." }, { ref: "Hosea 3:5", ts: "1:20:00", why: "Own moment." }] },
  ],
};
const readPass = (v) => (v === pass.video ? pass : null);
const hasChapter = (book, chapter) => ["Micah", "Hosea", "1 Kings"].includes(book) && chapter < 20;
const doc = (answers) => ({ doctrines: [{ slug: "x", name: "X", claim: "Y", answers }] });

test("references split into book, chapter and verses", () => {
  assert.deepEqual(splitRef("1 Thessalonians 4:16-18"), { book: "1 Thessalonians", chapter: 4, verses: "16-18" });
  assert.deepEqual(splitRef("Ecclesiasticus 19:19-22"), { book: "Sirach", chapter: 19, verses: "19-22" });
  assert.deepEqual(blockRef("Jeremiah 10:1-5", "v3-4"), { book: "Jeremiah", chapter: 10, verses: "3-4" });
  assert.equal(splitRef("not a ref"), null);
});

test("an answer takes the teacher, moment and exact paragraphs of the pass", () => {
  const { doctrines, problems } = resolveDoctrine(doc([{ video: pass.video, opened: "Micah 5:3", at: "Hosea 1:10-11", paras: ["Only Israel."] }]), { readPass, hasChapter });
  assert.deepEqual(problems, []);
  const [a] = doctrines[0].answers;
  assert.equal(a.text, "Only Israel.");
  assert.equal(a.teacher, "Deacon Eythan");
  assert.equal(a.ts, "1:16:38");
  assert.equal(a.t, 4598);
  assert.deepEqual(a.ref, { book: "Hosea", chapter: 1, verses: "10-11" });
});

test("a precept with its own timestamp keeps it", () => {
  const { doctrines } = resolveDoctrine(doc([{ video: pass.video, opened: "Micah 5:3", at: "Hosea 3:5", paras: ["Own moment."] }]), { readPass, hasChapter });
  assert.equal(doctrines[0].answers[0].ts, "1:20:00");
  assert.equal(doctrines[0].answers[0].t, 4800);
});

test("a verse block answers with the opened chapter and that verse", () => {
  const { doctrines } = resolveDoctrine(doc([{ video: pass.video, opened: "Micah 5:3", at: "v3", paras: ["One.", "Two."] }]), { readPass, hasChapter });
  assert.equal(doctrines[0].answers[0].text, "One.\n\nTwo.");
  assert.deepEqual(doctrines[0].answers[0].ref, { book: "Micah", chapter: 5, verses: "3" });
});

test("pointers that do not resolve are problems, never guessed", () => {
  const { problems } = resolveDoctrine(doc([
    { video: "zzzzzzzzzzz", opened: "Micah 5:3", at: "v3", paras: ["One."] },
    { video: pass.video, opened: "Micah 6:1", at: "v3", paras: ["One."] },
    { video: pass.video, opened: "Micah 5:3", at: "Isaiah 1:1", paras: ["One."] },
    { video: pass.video, opened: "Micah 5:3", at: "v3", paras: ["Three."] },
  ]), { readPass, hasChapter });
  // One each for the class with no pass, the passage and the precept it lacks; two for the missing
  // paragraph (no match, so nothing picked); and the doctrine left with no answers.
  assert.equal(problems.length, 6);
});

test("data/doctrine.json resolves against the merged passes", () => {
  const { doctrines, problems } = loadDoctrine(ROOT);
  assert.deepEqual(problems, []);
  assert.ok(doctrines.length > 0);
  for (const d of doctrines) assert.ok(d.answers.every((a) => a.text && a.video && a.ts));
});
