import React, { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useHistory } from "@docusaurus/router";
import useBaseUrl from "@docusaurus/useBaseUrl";
import booksData from "../../static/api/kjv/books.json";

type Book = { book: string; slug: string; testament: string; chapters: number; verses: number; chapterIds: number[] };
type Citation = { kind: string; label: string; url: string; verses: string };
type SelectedVerse = { number: number; text: string };
type Filter = "All" | "Old Testament" | "New Testament" | "Apocrypha";
type ReaderSize = "compact" | "normal" | "large";

const books = booksData as Book[];
const sizes: ReaderSize[] = ["compact", "normal", "large"];

function verseMatches(reference: string, verse: number) {
  if (!reference) return false;
  return reference.split(",").some((part) => {
    const [start, end] = part.trim().split("-").map(Number);
    return Number.isFinite(start) && verse >= start && verse <= (Number.isFinite(end) ? end : start);
  });
}

export default function BibleAppShell({ bookSlug, chapter, children }: {
  bookSlug?: string; chapter?: number; children: ReactNode;
}) {
  const history = useHistory();
  const base = useBaseUrl("/").replace(/\/$/, "");
  const articleRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [size, setSize] = useState<ReaderSize>("normal");
  const [selected, setSelected] = useState<SelectedVerse | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [copied, setCopied] = useState("");
  const currentIndex = books.findIndex((book) => book.slug === bookSlug);
  const currentBook = books[currentIndex];
  const chapterIds = currentBook?.chapterIds ?? [];
  const chapterIndex = chapter === undefined ? -1 : chapterIds.indexOf(chapter);

  const go = (slug: string, nextChapter?: number, hash = "") => {
    setLibraryOpen(false); setToolsOpen(false);
    history.push(`${base}/bible/${slug}${nextChapter === undefined ? "" : `/${nextChapter}`}${hash}`);
  };

  useEffect(() => {
    document.documentElement.dataset.bibleApp = "true";
    const stored = window.localStorage.getItem("cj-reader-size") as ReaderSize | null;
    const initial = stored && sizes.includes(stored) ? stored : "normal";
    setSize(initial); document.documentElement.dataset.readerSize = initial;
    if (bookSlug && chapter !== undefined) window.localStorage.setItem("cj-last-chapter", `${bookSlug}/${chapter}`);
    return () => { delete document.documentElement.dataset.bibleApp; delete document.documentElement.dataset.readerSize; };
  }, [bookSlug, chapter]);

  useEffect(() => {
    setSelected(null); setCopied("");
    if (!bookSlug || chapter === undefined) { setCitations([]); return; }
    fetch(`${base}/api/concordance/${bookSlug}/${chapter}.json`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setCitations(data.cited_by ?? []))
      .catch(() => setCitations([]));
  }, [base, bookSlug, chapter]);

  useEffect(() => {
    const article = articleRef.current;
    if (!article || chapter === undefined) return;
    const verses = Array.from(article.querySelectorAll<HTMLElement>(".scripture .verse"));
    const select = (event: Event) => {
      const verse = (event.currentTarget as HTMLElement);
      const number = Number(verse.id.replace("v", ""));
      verses.forEach((node) => node.classList.remove("is-selected"));
      verse.classList.add("is-selected");
      const text = verse.textContent?.replace(/^\s*\d+\s*/, "").trim() ?? "";
      setSelected({ number, text }); setToolsOpen(true);
      history.replace(`${window.location.pathname}${window.location.search}#v${number}`);
    };
    verses.forEach((verse) => verse.addEventListener("click", select));
    return () => verses.forEach((verse) => verse.removeEventListener("click", select));
  }, [chapter, history]);

  const filteredBooks = useMemo(() => books.filter((book) =>
    (filter === "All" || book.testament === filter) && book.book.toLowerCase().includes(query.toLowerCase())
  ), [filter, query]);

  const dedupedCitations = useMemo(() => {
    const relevant = selected ? citations.filter((item) => verseMatches(item.verses, selected.number)) : citations;
    const seen = new Set<string>();
    return relevant.filter((item) => {
      const key = `${item.kind}|${item.url}|${item.label}`;
      if (seen.has(key)) return false; seen.add(key); return true;
    });
  }, [citations, selected]);

  const previous = chapterIndex > 0 ? { slug: bookSlug!, chapter: chapterIds[chapterIndex - 1] }
    : currentIndex > 0 && chapter !== undefined ? { slug: books[currentIndex - 1].slug, chapter: books[currentIndex - 1].chapterIds.at(-1)! } : null;
  const next = chapterIndex >= 0 && chapterIndex < chapterIds.length - 1 ? { slug: bookSlug!, chapter: chapterIds[chapterIndex + 1] }
    : currentIndex >= 0 && currentIndex < books.length - 1 && chapter !== undefined ? { slug: books[currentIndex + 1].slug, chapter: books[currentIndex + 1].chapterIds[0] } : null;

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value); setCopied(label); window.setTimeout(() => setCopied(""), 1500);
  };
  const reference = selected && currentBook ? `${currentBook.book} ${chapter}:${selected.number}` : "";

  return <div className="cj-bible-app">
    <header className="cj-app-head">
      <div><span className="cj-app-kicker">SCRIPTURE_OS</span><strong>The Holy Bible</strong><small>KJV + Apocrypha · {books.length} books</small></div>
      <div className="cj-mobile-actions">
        <button type="button" onClick={() => setLibraryOpen(true)}>☰ Library</button>
        <button type="button" onClick={() => setToolsOpen(true)}>Tools ›</button>
      </div>
    </header>
    {(libraryOpen || toolsOpen) && <button className="cj-drawer-shade" aria-label="Close panels" onClick={() => { setLibraryOpen(false); setToolsOpen(false); }} />}
    <div className="cj-app-grid">
      <aside className={`cj-library ${libraryOpen ? "is-open" : ""}`} aria-label="Bible library">
        <div className="cj-panel-title"><span>LIBRARY</span><button type="button" onClick={() => setLibraryOpen(false)}>×</button></div>
        <label className="cj-book-search"><span>›</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a book..." /></label>
        <div className="cj-testaments">
          {(["All", "Old Testament", "New Testament", "Apocrypha"] as Filter[]).map((item) =>
            <button type="button" key={item} className={filter === item ? "is-active" : ""} onClick={() => setFilter(item)}>{item === "All" ? "ALL" : item.split(" ")[0].slice(0, 3).toUpperCase()}</button>)}
        </div>
        <div className="cj-book-list">
          {filteredBooks.map((book) => <button type="button" key={book.slug} className={book.slug === bookSlug ? "is-active" : ""}
            onClick={() => go(book.slug, book.chapterIds[0])}><span>{book.book}</span><small>{book.chapters}</small></button>)}
        </div>
        {currentBook && <section className="cj-chapter-picker">
          <div><strong>{currentBook.book}</strong><small>{currentBook.testament}</small></div>
          <div className="cj-chapter-grid">{chapterIds.map((id) => <button type="button" key={id} className={id === chapter ? "is-active" : ""} onClick={() => go(currentBook.slug, id)}>{id}</button>)}</div>
        </section>}
      </aside>

      <main className="cj-reading-pane">
        {currentBook && chapter !== undefined && <nav className="cj-readerbar" aria-label="Chapter controls">
          <button type="button" disabled={!previous} onClick={() => previous && go(previous.slug, previous.chapter)} aria-label="Previous chapter">‹</button>
          <label><span className="sr-only">Book</span><select value={bookSlug} onChange={(e) => { const book = books.find((b) => b.slug === e.target.value); if (book) go(book.slug, book.chapterIds[0]); }}>{books.map((book) => <option value={book.slug} key={book.slug}>{book.book}</option>)}</select></label>
          <label><span className="sr-only">Chapter</span><select value={chapter} onChange={(e) => go(currentBook.slug, Number(e.target.value))}>{chapterIds.map((id) => <option value={id} key={id}>Chapter {id}</option>)}</select></label>
          <button type="button" disabled={!next} onClick={() => next && go(next.slug, next.chapter)} aria-label="Next chapter">›</button>
          <div className="cj-reader-size">{sizes.map((item) => <button type="button" key={item} className={size === item ? "is-active" : ""} onClick={() => { setSize(item); document.documentElement.dataset.readerSize = item; localStorage.setItem("cj-reader-size", item); }}>{item === "compact" ? "A−" : item === "large" ? "A+" : "A"}</button>)}</div>
        </nav>}
        {!currentBook && <div className="cj-app-welcome"><span>READY</span><h1>Open the Scriptures</h1><p>Search all 81 books, choose a chapter, then tap any verse to select, copy, link, and explore every connected study record.</p><button type="button" onClick={() => go("genesis", 1)}>Begin at Genesis 1 →</button></div>}
        <article ref={articleRef} className={`cj-reader-article ${!chapter ? "cj-reader-index" : ""}`}>{children}</article>
      </main>

      <aside className={`cj-study-tools ${toolsOpen ? "is-open" : ""}`} aria-label="Verse tools">
        <div className="cj-panel-title"><span>VERSE_TOOLS</span><button type="button" onClick={() => setToolsOpen(false)}>×</button></div>
        {selected ? <>
          <div className="cj-selected-verse"><small>SELECTED</small><strong>{reference}</strong><p>{selected.text}</p></div>
          <div className="cj-copy-actions">
            <button type="button" onClick={() => copy(`${reference} — ${selected.text}`, "verse")}>{copied === "verse" ? "✓ Copied" : "Copy verse"}</button>
            <button type="button" onClick={() => copy(window.location.href, "link")}>{copied === "link" ? "✓ Copied" : "Copy link"}</button>
          </div>
        </> : <div className="cj-tools-empty"><b>+</b><p>Select any verse in the text to open its actions and connected records.</p></div>}
        {currentBook && chapter !== undefined && <section className="cj-related">
          <div className="cj-related-head"><span>{selected ? `LINKED TO VERSE ${selected.number}` : "CHAPTER RECORDS"}</span><b>{dedupedCitations.length}</b></div>
          {dedupedCitations.slice(0, 20).map((item) => <a key={`${item.kind}-${item.url}-${item.label}`} href={`${base}${item.url}`}><small>{item.kind}</small><span>{item.label}</span>{item.verses && <em>vv. {item.verses}</em>}</a>)}
          {dedupedCitations.length === 0 && <p className="cj-related-none">No verse-specific records found.</p>}
        </section>}
      </aside>
    </div>
  </div>;
}
