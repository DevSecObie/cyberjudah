# AGENTS.md

Instructions for coding agents (ChatGPT Codex and others) working in this repository.

## Precept passes (the main job for agents here)

CyberJudah's Bible app is a King James Bible (1611 order, with the Apocrypha) in which every verse shows what the CyberJudah classes taught about it. It is not an ordinary Bible app. It is meant to be comprehensive: every precept a class paired with a scripture, and a full breakdown of why it is there, in the class's own understanding. Get all the meat off the bone.

A **precept pass** turns one class that has no study note yet into one data file, `data/precepts/classes/<video id>.json`. When it merges, the app shows:
- each precept under the verse it explains;
- the breakdown of why it is there;
- the class's own breakdown of each verse in the verse's Comments;
- a link to the class on YouTube at the moment it was read.

### The workflow

1. **Pick the classes.** `python3 scripts/precepts/classes.py next 5` lists the next classes to do, newest first (date, video id, title). `python3 scripts/precepts/classes.py next 5 --book Isaiah` lists instead the classes that read the most verses of that book, so a book can be filled in class by class. `python3 scripts/precepts/classes.py series revelation` lists a series of classes in order (`data/precepts/series.tsv`), the ones done marked; a class uploaded twice is listed once, under the id to use, with its twin noted. Do the ones you are asked to do, or the first on the list.
2. **Read the class.** The transcript is `blog/transcripts/<video id>.json`: `segments` is a list of `[start_seconds, text]` (auto-captions, unpunctuated and mis-heard in places). For a cleaner read with timestamps and the scripture references already verified:
   ```python
   import sys, json; sys.path.insert(0, "scripts/notes"); import auto
   t = json.load(open("blog/transcripts/<video id>.json"))
   text, refs, who = auto.prepare(t)   # text: the class condensed with [m:ss] times; refs: verified references in order; who: teacher, if found
   ```
   When the class never names its teacher, `who` comes from `data/sources/class-teachers.tsv`: who the sabbath-classes-images transcripts are filed under. A name the class gives itself always wins.
   Read ALL of it before writing. `refs` is a strong hint, not a limit: a passage read as a range (Isaiah 61:1-3) may show there as single verses.
3. **Write** `data/precepts/classes/<video id>.json` by the rules below. The King James text is in `data/bible/<book slug>.json` (`chapters["<n>"][verse - 1]`). Use it for every quote.
4. **Check it:** `python3 scripts/precepts/classes.py check data/precepts/classes/<video id>.json` must print `0 problem(s)`. The same check runs on the pull request.
5. **Open one pull request per class:**
   - branch `precepts/<video id>`;
   - title `Precept pass: <class title>`;
   - add only that one file;
   - in the description, give the number of passages and precepts, and any **Notes**.

   Do not edit anything else in the repository.
6. **Review.** Claude reviews every pass against the class and either merges it or requests changes in review comments. When a comment asks you to fix something (`@codex …`), fix it on the same branch and push. Do not open a new pull request.

### What to extract

#### 1. Every scripture the class OPENED
A scripture is "opened" when the teacher calls for it, it is read aloud, and it is taught. For each one record:
- `opened`: the reference exactly as it was read, e.g. `"Isaiah 61:1-3"`, `"Genesis 1:1"`, `"Luke 19:11-27"`. Use the full range that was actually read, not just the first verse.
- `teacher`: who taught this passage, with the title and spelling as the class gives it (e.g. `"Bishop Nathanyel"`, `"Deacon Malachi"`, `"Captain Gideon"`). A long class often has several teachers; record the one teaching at this passage. Leave empty only if the class never says.
- `ts`: the timestamp where the reading begins, as `m:ss` or `h:mm:ss`, from the transcript line where it happened.

Keep the passages in the order the class opened them.

#### 1b. The class's own breakdown of the scripture (`sense`)
Every opened scripture gets its breakdown, whether or not precepts were read with it: how the class gave the sense of it, verse by verse. This goes in the verse's Comments in the app. For each verse (or short run of verses) the class explained, record:
- `at`: the verse number (or a short range like `"4-5"`) inside the opened passage.
- `text`: everything the class drew from that verse. What it means, the words defined, who and what it is speaking of, how it fits the history, and how the class applied it. Use short paragraphs separated by `\n\n`, with the same rules and voice as the precept breakdowns. Quote the verse only word for word from the KJV.

If a verse was read but not explained, leave it out of `sense`.

#### 2. Every PRECEPT read with it
A precept is another scripture the class read to support, prove, define or explain the opened scripture, before moving on to the next opened scripture. For each precept record:
- `ref`: the reference exactly as read (book chapter:verse or range).
- `at`: which verse of the opened passage it explains, as a number inside the opened range. Use a short range like `"4-5"` only if it plainly speaks to both. If the opened scripture is a single verse, `at` is that verse.
- `why`: the breakdown (see below).

A scripture that gets its own teaching with its own precepts is an opened scripture in its own right, not a precept.

#### 3. The breakdown (`why`) for each precept
Write everything the class drew from that precept at that moment. Go deep:
- What the precept says, and what it proves or explains about the opened verse.
- The verses read around it, if the class kept reading (e.g. the class opened 2 Esdras 6:38 and read on to 6:40, so use 6:39-40 too).
- The points the class made from it, the connections drawn to other scriptures read in that moment, words the class defined, names and places identified, history given, and how the class applied it to our people today.
- The class's conclusion: why it matters for understanding the opened scripture.

Use as many short paragraphs as it takes, separated by a blank line (`\n\n` in the JSON). Don't pad it and don't repeat yourself, but leave nothing out that the class taught.

---

### Rules (these are strict)

0. **The Bishops' and Deacons' teaching takes precedence over everyone else's.** Their breakdowns stand as written. Where another teacher in the same class says something different about a scripture, give the Bishop's or Deacon's understanding. Always record `teacher` so the app can put their teaching first.

1. **Never invent a reference.** Only scriptures actually read in the class. If the captions garble a reference ("second Ezra six and thirty-eight" is 2 Esdras 6:38), fix it only when the verse that was read proves which one it is. If you can't tell, leave it out.
2. **Skip what was not taught:** verses only listed on a dictionary or commentary screen and not read; a scripture called for and then dropped; readings with no teaching (an opening prayer, the bread and wine).
3. **Quote scripture exactly** in the King James Version (1611, with the Apocrypha), inside curly quotes “like this”. Only quote words that were actually read in that moment of the class, and copy them word for word, spelling included ("spakest", "commandedst", "saith"). Never paraphrase inside quotes.
4. **Say it as the class's understanding, plainly and warmly.** Never write "the teacher says", "the class teaches", "this precept" or "the speaker". Just say it: "Christ is that light."
5. **Stay inside what the class taught.** No outside doctrine, commentary or verses the class did not read. If the class taught it, include it, even if it is strong.
5b. **Keep the class's exact language.** Where the class used strong words, slurs or profanity to make a point, keep them exactly as said. Never soften, censor or clean up the teaching. (Where the recording itself bleeps a word, as `[ __ ]`, leave it out rather than guess.)
6. **Keep names and titles exactly as the class used them** (Israel, Edom, Esau, the Most High, Christ, etc.).
7. **Nothing about captions or transcripts** in the text.
8. **Book names:** use these names, including for the Apocrypha: 1 Esdras, 2 Esdras, Tobit, Judith, Rest of Esther, Wisdom of Solomon, Ecclesiasticus (Sirach), Baruch, Epistle of Jeremiah, Song of the Three Holy Children, History of Susanna, Bel and the Dragon, Prayer of Manasses, 1 Maccabees, 2 Maccabees. Use the standard KJV names for the other 66 books ("Psalms", "Song of Solomon", "1 Kings", "Revelation").
9. If the transcript has no timestamps for a moment, give your best timestamp from the surrounding lines. Never leave `ts` empty when the transcript has times.

---

### Output

Write ONE JSON file, `data/precepts/classes/<video id>.json`, exactly in this shape:

```json
{
  "video": "<YouTube video id>",
  "title": "<class title>",
  "date": "YYYY-MM-DD",
  "teacher": "<teacher's name if said in the class, else empty>",
  "passages": [
    {
      "opened": "Isaiah 61:1-3",
      "teacher": "Bishop Nathanyel",
      "ts": "29:11",
      "sense": [
        { "at": "1", "text": "Paragraph one.\n\nParagraph two." }
      ],
      "precepts": [
        { "ref": "Luke 21:24", "at": "1", "why": "Paragraph one.\n\nParagraph two." }
      ]
    }
  ]
}
```

Include opened passages that have no precepts, with `"precepts": []`. Every opened passage that was taught should have a `sense` entry for each verse the class explained.

Put anything uncertain (a reference you could not confirm, a reading you left out) in the pull request description under **Notes**, not in the JSON.

#### Check before you open the pull request
- The JSON is valid.
- Every `ref` and `opened` is a real KJV reference, and was read in the class.
- Every `at` (in `sense` and in `precepts`) falls inside its opened range.
- Every quoted phrase is word for word from the KJV, and from a verse read in that moment.
- Passages are in the order opened, with timestamps rising.

---

### The approved example

This is the depth and voice wanted. From "The Kingdom Of Adam And The Old World" (2025-12-26), Genesis 1:1 opened at 2:37:09; the class read Genesis 1:1-5, 2 Esdras 6:38-40, John 1:1-10 and John 8:12.

```json
{
  "opened": "Genesis 1:1",
  "ts": "2:37:09",
  "precepts": [
    {
      "ref": "2 Esdras 6:38",
      "at": "1",
      "why": "Ezra says the Lord spoke “from the beginning of the creation, even the first day”, saying “Let heaven and earth be made; and thy word was a perfect work.” The word that did that perfect work is Christ.\n\nRead on and Ezra shows what was there before anything was made: “darkness and silence were on every side; the sound of man’s voice was not yet formed.” Nothing, a great void. “Then commandedst thou a fair light to come forth of thy treasures, that thy work might appear.” That fair light out of God’s treasures is the light of Genesis 1:3, and it is worded that way because that light is what made everything else: it came forth so that God’s works could appear.\n\nSo “in the beginning” is not only the making of the earth and the sky. It is the beginning of all creation, and it begins with Christ, the first thing God created, the light called forth on the first day."
    },
    {
      "ref": "John 1:4",
      "at": "1",
      "why": "John opens the way Genesis does: “In the beginning was the Word, and the Word was with God, and the Word was God.” The Word that was with God is Christ. He was a God in the beginning, made in the image of his Father, creating angels, galaxies and planets. “The same was in the beginning with God”: two different persons, the Father and the Son.\n\n“All things were made by him; and without him was not any thing made that was made.” Then: “In him was life; and the life was the light of men. And the light shineth in darkness.” That is the same light God brought out of his treasures in 2 Esdras 6, the light of Genesis 1.\n\nJohn the Baptist “came for a witness, to bear witness of the Light”, and “He was not that Light.” Christ is “the true Light, which lighteth every man that cometh into the world”: the true light God created on the first day."
    },
    {
      "ref": "John 8:12",
      "at": "1",
      "why": "Christ says it himself: “I am the light of the world: he that followeth me shall not walk in darkness, but shall have the light of life.” We read that Christ is the first thing created; we go to the first thing created and God says “Let there be light”; and here Christ says, I am that light. The scriptures line up.\n\nThat is why the light of Genesis 1:3 is not the light of the sun. The earth was “without form and void”, not yet made, and the sun and moon, the “two great lights”, were not made until “the fourth day.” Read with a carnal mind, it sounds like daylight; read with the spirit, it is the Son.\n\nMoses was told to hide these things and not make them plain for everyone, which is why Christ is called the hidden wisdom. Even the dividing of the light from the darkness, the light called day and the darkness night, is a similitude."
    }
  ]
}
```
