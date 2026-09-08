import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, ReadLink } from "@/components/site/chrome";
import { api } from "@/lib/api";
import { pageHead } from "@/lib/head";

const BOOK_ORDER = ["Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth","1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi","Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter","1 John","2 John","3 John","Jude","Revelation","1 Esdras","2 Esdras","Tobit","Judith","Esther (Greek)","Wisdom of Solomon","Sirach","Baruch","Song of the Three Children","Susanna","Bel and the Dragon","Prayer of Manasseh","1 Maccabees","2 Maccabees","Epistle of Jeremiah"];

export const Route = createFileRoute("/study/")({
  loader: async () => {
    const notes = (await api.notes()).filter((n) => n.kind === "study" && n.book && n.chapters);
    const byBook = new Map<string, typeof notes>();
    for (const n of notes) { const l = byBook.get(n.book!) ?? []; l.push(n); byBook.set(n.book!, l); }
    const books = [...byBook.keys()].sort((a, b) => BOOK_ORDER.indexOf(a) - BOOK_ORDER.indexOf(b));
    return { groups: books.map((b) => ({ book: b, notes: byBook.get(b)!.sort((x, y) => x.chapters![0] - y.chapters![0]) })), total: notes.length };
  },
  head: ({ match }) => pageHead([{ title: "4 Chapters a Day · CyberJudah" }, { name: "description", content: "Notes from the daily reading, one page per chapter, every verse taught quoted in place." }], match),
  component: StudyIndex,
});

function StudyIndex() {
  const { groups, total } = Route.useLoaderData();
  return (
    <Page>
      <h1 className="cj-h1">4 Chapters a Day.</h1>
      <p className="cj-lede">Notes from the daily reading in the order the books are read: {total} chapters taught across {groups.length} books, every verse taught quoted in place.</p>
      <p style={{ marginBottom: "2.5rem" }}><ReadLink to="/study/genesis/1">Start the plan at Genesis 1</ReadLink></p>
      {groups.map((g) => (
        <section key={g.book} className="book-block" id={g.book.toLowerCase().replace(/[^a-z0-9]+/g, "-")}>
          <h2>{g.book}</h2>
          <ul className="list">
            {g.notes.map((n) => (
              <li key={n.url}>
                <Link to={n.url as never}><span>{n.title}</span><span className="cj-mono">{n.range}</span></Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Page>
  );
}
