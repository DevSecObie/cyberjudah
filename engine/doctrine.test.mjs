import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blockRef, explanation, loadDoctrine, pointsFor, resolveDoctrine, splitRef } from "./doctrine.mjs";

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

const transcript = { title: "A radio show", date: "2026-02-02", segments: [[100, "turn to isaiah 1 3"], [130, "but israel does not know where"], [133, "their [ __ ] homeland is"], [400, "brother kemuel said that"]] };
const readTranscript = (v) => (v === "lmnopqrstuv" ? transcript : null);
const quote = (q) => resolveDoctrine(doc([{ video: "lmnopqrstuv", from: "2:10", to: "2:15", ref: "Isaiah 1:3", ...q }]), { readPass, readTranscript, hasChapter: () => true, teacherOf: () => "Deacon Eythan" });

test("a quotation must be the captions' own words, near the scripture it answers from", () => {
  const ok = quote({ text: "But Israel does not know where their … homeland is." });
  assert.deepEqual(ok.problems, []);
  assert.equal(ok.doctrines[0].answers[0].teacher, "Deacon Eythan");
  assert.equal(ok.doctrines[0].answers[0].t, 130);
  assert.equal(quote({ text: "But Israel does not know where their true homeland is." }).problems.length, 2);
  assert.equal(quote({ ref: "Jeremiah 1:3", text: "But Israel does not know" }).problems.length, 2);
});

test("a quotation names its own teacher only when the class names him", () => {
  assert.equal(quote({ text: "But Israel does not know", teacher: "Captain Kemuel" }).doctrines[0].answers[0].teacher, "Captain Kemuel");
  assert.equal(quote({ text: "But Israel does not know", teacher: "Captain Gideon" }).problems.length, 2);
});

test("a doctrine's scriptures are verses the classes used, never more", () => {
  const deps = { readPass, hasChapter, verseCount: () => 20, classUses: (book, chapter, v) => book === "Hosea" && v < 12 };
  const one = (scriptures) => resolveDoctrine({ doctrines: [{ slug: "x", name: "X", claim: "Y", scriptures, answers: [{ video: pass.video, opened: "Micah 5:3", at: "v3", paras: ["One."] }] }] }, deps);
  assert.deepEqual(one(["Hosea 1:10-11"]).doctrines[0].scriptures, [{ book: "Hosea", chapter: 1, verses: "10-11" }]);
  assert.equal(one(["Hosea 1:10-12"]).problems.length, 1);
  assert.equal(one(["Hosea 1:21"]).problems.length, 1);
  assert.equal(one(["Micah 5:3"]).problems.length, 1);
});

test("the points under a scripture are the classes' own paragraphs on that verse", () => {
  const from = (video, teacher) => ({ video, teacher, title: "T", date: "", ts: "1:00" });
  const said = new Map([["Hosea|1|10", [
    { ...from("aaaaaaaaaaa", "Deacon Eythan"), text: "A long one about the sand of the sea, that it is Israel only and no other nation on earth.", only: true },
    { ...from("bbbbbbbbbbb", "Bishop Nathanyel"), text: "A short one, ten words and no more than ten here.", only: true },
    { ...from("bbbbbbbbbbb", "Bishop Nathanyel"), text: "The same class again, which should never be taken twice over.", only: true },
    { ...from("ccccccccccc", "Bishop Kani"), text: "A run of verses that never quotes this one at all, not even once.", only: false },
    { ...from("ddddddddddd", "Bishop Kani"), text: "Already an answer, quoted above as one of the doctrine answers.", only: true },
  ]]]);
  const verseText = () => "Yet the number of the children of Israel shall be as the sand of the sea";
  const pts = pointsFor({ book: "Hosea", chapter: 1, verses: "10" }, { said, heard: new Map(), terms: "israel only", taken: new Set(["Already an answer, quoted above as one of the doctrine answers."]), verseText });
  assert.deepEqual(pts.map((p) => p.video), ["aaaaaaaaaaa", "bbbbbbbbbbb"]);
  const read = pointsFor({ book: "Hosea", chapter: 2, verses: "1" }, { said, heard: new Map([["Hosea|2|1", [["eeeeeeeeeee", 3725]]]]), readTranscript: () => ({ title: "A class", date: "2026-01-01" }) });
  assert.deepEqual(read, [{ video: "eeeeeeeeeee", ts: "1:02:05", t: 3725, title: "A class", date: "2026-01-01", read: true }]);
});

test("a point keeps the explanation and names the verses it recites", () => {
  const job3 = ["There the wicked cease from troubling; and there the weary be at rest.", "There the prisoners rest together; they hear not the voice of the oppressor."];
  assert.equal(explanation("“There the wicked cease from troubling”: notice that, in death even the wicked cease. “And there the weary be at rest.” “There the prisoners rest together”: our people.", "Job", 3, job3),
    "(Job 3:1): notice that, in death even the wicked cease. (Job 3:2): our people.");
  assert.equal(explanation("There, when you are dead, “the wicked cease from troubling” people.", "Job", 3, job3), "");
  assert.equal(explanation("As Isaiah says, “I am the Lord, and there is none else”, so the Lord alone is God and no man.", "Job", 3, job3), "As Isaiah says, “I am the Lord, and there is none else”, so the Lord alone is God and no man.");
});

test("data/doctrine.json resolves against the merged passes", () => {
  const { doctrines, problems } = loadDoctrine(ROOT);
  assert.deepEqual(problems, []);
  assert.ok(doctrines.length > 0);
  for (const d of doctrines) assert.ok(d.answers.every((a) => a.text && a.video && a.ts));
});
