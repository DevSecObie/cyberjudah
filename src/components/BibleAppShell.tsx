import React, { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHistory } from "@docusaurus/router";
import useBaseUrl from "@docusaurus/useBaseUrl";
import booksData from "../../static/api/kjv/books.json";
import "../css/scripture-os.css";

type Book = { book: string; slug: string; testament: string; chapters: number; verses: number; chapterIds: number[] };
type Citation = { kind: string; label: string; url: string; verses: string };
type Filter = "All" | "Old Testament" | "New Testament" | "Apocrypha";
type ReaderSize = "compact" | "normal" | "large";
type Bookmark = { slug: string; chapter: number; verse: number; ref: string; text: string };
type HighlightColor = "cyan" | "magenta" | "amber";

const books = booksData as Book[];
const sizes: ReaderSize[] = ["compact", "normal", "large"];
const HL_COLORS: HighlightColor[] = ["cyan", "magenta", "amber"];

/* localStorage, guarded: private windows and previews can throw on access. */
const store = {
  get<T>(key: string, fallback: T): T {
    try { const raw = window.localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
  },
  set(key: string, value: unknown) { try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* best effort */ } },
  getRaw(key: string): string | null { try { return window.localStorage.getItem(key); } catch { return null; } },
};

function verseMatches(reference: string, verse: number) {
  if (!reference) return false;
  return reference.split(",").some((part) => {
    const [start, end] = part.trim().split("-").map(Number);
    return Number.isFinite(start) && verse >= start && verse <= (Number.isFinite(end) ? end : start);
  });
}

/* [1,2,3,5] -> "1-3,5" */
function formatRanges(nums: number[]) {
  const sorted = [...nums].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(j > i ? `${sorted[i]}-${sorted[j]}` : `${sorted[i]}`);
    i = j;
  }
  return parts.join(",");
}

let notesIndexPromise: Promise<Record<string, string>> | null = null;

export default function BibleAppShell({ bookSlug, chapter, children }: {
  bookSlug?: string; chapter?: number; children: ReactNode;
}) {
  const history = useHistory();
  const base = useBaseUrl("/").replace(/\/$/, "");
  const articleRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [size, setSize] = useState<ReaderSize>("normal");
  const [selected, setSelected] = useState<number[]>([]);
  const selectedRef = useRef<number[]>([]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  const anchorRef = useRef<number | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [copied, setCopied] = useState("");
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [highlights, setHighlights] = useState<Record<number, HighlightColor>>({});
  const [readMap, setReadMap] = useState<Record<string, number[]>>({});
  const [lastRead, setLastRead] = useState<{ slug: string; chapter: number } | null>(null);
  const [readingVerse, setReadingVerse] = useState<number | null>(null);
  const [speechState, setSpeechState] = useState<"idle" | "playing" | "paused">("idle");
  const speechRun = useRef(0);
  const currentIndex = books.findIndex((book) => book.slug === bookSlug);
  const currentBook = books[currentIndex];
  const chapterIds = currentBook?.chapterIds ?? [];
  const chapterIndex = chapter === undefined ? -1 : chapterIds.indexOf(chapter);

  const go = useCallback((slug: string, nextChapter?: number, hash = "") => {
    setLibraryOpen(false); setToolsOpen(false);
    history.push(`${base}/bible/${slug}${nextChapter === undefined ? "" : `/${nextChapter}`}${hash}`);
  }, [base, history]);

  const verseNodes = () => Array.from(articleRef.current?.querySelectorAll<HTMLElement>(".scripture .verse") ?? []);
  const verseText = (node: HTMLElement) => node.textContent?.replace(/^\s*\d+\s*/, "").trim() ?? "";
  const verseByNumber = (n: number) => articleRef.current?.querySelector<HTMLElement>(`.scripture .verse#v${n}`) ?? null;

  /* boot: size, last-read pointer, per-user memory */
  useEffect(() => {
    document.documentElement.dataset.bibleApp = "true";
    const stored = store.getRaw("cj-reader-size") as ReaderSize | null;
    const cleanStored = stored?.replace(/"/g, "") as ReaderSize | undefined;
    const initial = cleanStored && sizes.includes(cleanStored) ? cleanStored : "normal";
    setSize(initial); document.documentElement.dataset.readerSize = initial;
    setBookmarks(store.get<Bookmark[]>("cj-bookmarks", []));
    setReadMap(store.get<Record<string, number[]>>("cj-read", {}));
    const last = store.getRaw("cj-last-chapter")?.replace(/"/g, "");
    if (last) { const [slug, ch] = last.split("/"); if (slug && ch) setLastRead({ slug, chapter: Number(ch) }); }
    if (bookSlug && chapter !== undefined) {
      try { window.localStorage.setItem("cj-last-chapter", `${bookSlug}/${chapter}`); } catch { /* best effort */ }
      setLastRead({ slug: bookSlug, chapter });
      setReadMap((prev) => {
        const chapters = new Set(prev[bookSlug] ?? []);
        if (chapters.has(chapter)) return prev;
        chapters.add(chapter);
        const nextMap = { ...prev, [bookSlug]: [...chapters].sort((a, b) => a - b) };
        store.set("cj-read", nextMap);
        return nextMap;
      });
    }
    return () => { delete document.documentElement.dataset.bibleApp; delete document.documentElement.dataset.readerSize; };
  }, [bookSlug, chapter]);

  /* per-chapter: citations, highlights, selection from the URL hash */
  useEffect(() => {
    setSelected([]); anchorRef.current = null; setCopied("");
    stopReading();
    if (!bookSlug || chapter === undefined) { setCitations([]); setHighlights({}); return; }
    setHighlights(store.get<Record<string, Record<number, HighlightColor>>>("cj-highlights", {})[`${bookSlug}/${chapter}`] ?? {});
    const hashVerse = /^#v(\d+)$/.exec(window.location.hash)?.[1];
    if (hashVerse) { setSelected([Number(hashVerse)]); anchorRef.current = Number(hashVerse); }
    fetch(`${base}/api/concordance/${bookSlug}/${chapter}.json`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setCitations(data.cited_by ?? []))
      .catch(() => setCitations([]));
    notesIndexPromise ??= fetch(`${base}/api/notes/index.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((rows: { url: string; summary?: string }[]) => Object.fromEntries(rows.filter((n) => n.summary).map((n) => [n.url, n.summary!])))
      .catch(() => ({}));
    notesIndexPromise.then(setSummaries);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, bookSlug, chapter]);

  /* same-page hash navigation (a #vN link clicked while already on the chapter) */
  useEffect(() => {
    const onHash = () => {
      const match = /^#v(\d+)$/.exec(window.location.hash);
      if (match) { const n = Number(match[1]); setSelected([n]); anchorRef.current = n; }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  /* click selection: plain = single, shift = range from anchor, ctrl/cmd = toggle */
  useEffect(() => {
    const article = articleRef.current;
    if (!article || chapter === undefined) return;
    const verses = verseNodes();
    const select = (event: Event) => {
      const mouse = event as MouseEvent;
      const number = Number((event.currentTarget as HTMLElement).id.replace("v", ""));
      const prev = selectedRef.current;
      let next: number[];
      if (mouse.shiftKey && anchorRef.current !== null) {
        const [a, b] = [Math.min(anchorRef.current, number), Math.max(anchorRef.current, number)];
        next = Array.from({ length: b - a + 1 }, (_, i) => a + i);
      } else if (mouse.ctrlKey || mouse.metaKey) {
        next = prev.includes(number) ? prev.filter((n) => n !== number) : [...prev, number].sort((x, y) => x - y);
        anchorRef.current = number;
      } else {
        next = prev.length === 1 && prev[0] === number ? [] : [number];
        anchorRef.current = number;
      }
      setSelected(next);
      if (next.length) {
        setToolsOpen(true);
        history.replace(`${window.location.pathname}${window.location.search}#v${next[0]}`);
      }
    };
    verses.forEach((verse) => verse.addEventListener("click", select));
    return () => verses.forEach((verse) => verse.removeEventListener("click", select));
  }, [chapter, history]);

  /* sync DOM classes with state */
  useEffect(() => {
    if (chapter === undefined) return;
    const marked = new Set(bookmarks.filter((b) => b.slug === bookSlug && b.chapter === chapter).map((b) => b.verse));
    for (const node of verseNodes()) {
      const n = Number(node.id.replace("v", ""));
      node.classList.toggle("is-selected", selected.includes(n));
      node.classList.toggle("is-reading", readingVerse === n);
      node.classList.toggle("is-bookmarked", marked.has(n));
      for (const color of HL_COLORS) node.classList.toggle(`cj-hl-${color}`, highlights[n] === color);
    }
  }, [selected, highlights, bookmarks, readingVerse, bookSlug, chapter, children]);

  /* read aloud */
  const stopReading = useCallback(() => {
    speechRun.current++;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setReadingVerse(null); setSpeechState("idle");
  }, []);
  const startReading = useCallback((fromVerse?: number) => {
    if (!("speechSynthesis" in window) || !currentBook || chapter === undefined) return;
    window.speechSynthesis.cancel();
    const run = ++speechRun.current;
    const queue = verseNodes()
      .map((node) => ({ n: Number(node.id.replace("v", "")), text: verseText(node) }))
      .filter((v) => v.text && (fromVerse === undefined || v.n >= fromVerse));
    if (!queue.length) return;
    setSpeechState("playing");
    const speakAt = (i: number) => {
      if (run !== speechRun.current) return;
      if (i >= queue.length) { setReadingVerse(null); setSpeechState("idle"); return; }
      setReadingVerse(queue[i].n);
      verseByNumber(queue[i].n)?.scrollIntoView({ block: "center", behavior: "smooth" });
      const utterance = new SpeechSynthesisUtterance(queue[i].text);
      utterance.rate = 0.95;
      utterance.onend = () => speakAt(i + 1);
      utterance.onerror = () => { if (run === speechRun.current) { setReadingVerse(null); setSpeechState("idle"); } };
      window.speechSynthesis.speak(utterance);
    };
    speakAt(0);
  }, [currentBook, chapter]);
  const togglePause = useCallback(() => {
    if (!("speechSynthesis" in window)) return;
    if (speechState === "playing") { window.speechSynthesis.pause(); setSpeechState("paused"); }
    else if (speechState === "paused") { window.speechSynthesis.resume(); setSpeechState("playing"); }
  }, [speechState]);
  useEffect(() => () => { if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);

  /* bookmarks and highlights */
  const firstSelected = selected[0];
  const isBookmarked = firstSelected !== undefined && bookmarks.some((b) => b.slug === bookSlug && b.chapter === chapter && b.verse === firstSelected);
  const toggleBookmark = useCallback(() => {
    if (!currentBook || chapter === undefined || firstSelected === undefined) return;
    setBookmarks((prev) => {
      const exists = prev.some((b) => b.slug === bookSlug && b.chapter === chapter && b.verse === firstSelected);
      const next = exists
        ? prev.filter((b) => !(b.slug === bookSlug && b.chapter === chapter && b.verse === firstSelected))
        : [{ slug: bookSlug!, chapter, verse: firstSelected, ref: `${currentBook.book} ${chapter}:${firstSelected}`,
            text: (verseByNumber(firstSelected) ? verseText(verseByNumber(firstSelected)!) : "").slice(0, 120) }, ...prev].slice(0, 200);
      store.set("cj-bookmarks", next);
      return next;
    });
  }, [bookSlug, chapter, currentBook, firstSelected]);
  const applyHighlight = useCallback((color: HighlightColor | null) => {
    if (!bookSlug || chapter === undefined || !selected.length) return;
    setHighlights((prev) => {
      const next = { ...prev };
      for (const n of selected) { if (color) next[n] = color; else delete next[n]; }
      const all = store.get<Record<string, Record<number, HighlightColor>>>("cj-highlights", {});
      if (Object.keys(next).length) all[`${bookSlug}/${chapter}`] = next; else delete all[`${bookSlug}/${chapter}`];
      store.set("cj-highlights", all);
      return next;
    });
  }, [bookSlug, chapter, selected]);

  /* keyboard: arrows chapters, j/k verses, b bookmark, h highlight, p read, Esc clear */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, select, textarea, [contenteditable]") || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "Escape") { setSelected([]); setLibraryOpen(false); setToolsOpen(false); stopReading(); return; }
      if (chapter === undefined) return;
      if (event.key === "ArrowLeft" && previousTarget) { event.preventDefault(); go(previousTarget.slug, previousTarget.chapter); }
      else if (event.key === "ArrowRight" && nextTarget) { event.preventDefault(); go(nextTarget.slug, nextTarget.chapter); }
      else if (event.key === "j" || event.key === "k") {
        event.preventDefault();
        const all = verseNodes().map((node) => Number(node.id.replace("v", "")));
        if (!all.length) return;
        const current = selected.length ? (event.key === "j" ? Math.max(...selected) : Math.min(...selected)) : null;
        const idx = current === null ? (event.key === "j" ? -1 : all.length) : all.indexOf(current);
        const next = all[Math.min(all.length - 1, Math.max(0, idx + (event.key === "j" ? 1 : -1)))];
        setSelected([next]); anchorRef.current = next; setToolsOpen(true);
        verseByNumber(next)?.scrollIntoView({ block: "center", behavior: "smooth" });
        history.replace(`${window.location.pathname}${window.location.search}#v${next}`);
      }
      else if (event.key === "b") toggleBookmark();
      else if (event.key === "h") {
        const current = firstSelected !== undefined ? highlights[firstSelected] : undefined;
        const nextColor = current === undefined ? "cyan" : current === "cyan" ? "magenta" : current === "magenta" ? "amber" : null;
        applyHighlight(nextColor as HighlightColor | null);
      }
      else if (event.key === "p") { if (speechState === "idle") startReading(firstSelected); else togglePause(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const filteredBooks = useMemo(() => books.filter((book) =>
    (filter === "All" || book.testament === filter) && book.book.toLowerCase().includes(query.toLowerCase())
  ), [filter, query]);

  const dedupedCitations = useMemo(() => {
    const relevant = selected.length ? citations.filter((item) => selected.some((n) => verseMatches(item.verses, n))) : citations;
    const seen = new Set<string>();
    return relevant.filter((item) => {
      const key = `${item.kind}|${item.url}|${item.label}`;
      if (seen.has(key)) return false; seen.add(key); return true;
    });
  }, [citations, selected]);

  const previousTarget = chapterIndex > 0 ? { slug: bookSlug!, chapter: chapterIds[chapterIndex - 1] }
    : currentIndex > 0 && chapter !== undefined ? { slug: books[currentIndex - 1].slug, chapter: books[currentIndex - 1].chapterIds.at(-1)! } : null;
  const nextTarget = chapterIndex >= 0 && chapterIndex < chapterIds.length - 1 ? { slug: bookSlug!, chapter: chapterIds[chapterIndex + 1] }
    : currentIndex >= 0 && currentIndex < books.length - 1 && chapter !== undefined ? { slug: books[currentIndex + 1].slug, chapter: books[currentIndex + 1].chapterIds[0] } : null;

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value); setCopied(label); window.setTimeout(() => setCopied(""), 1500);
  };
  const selectedTexts = selected.map((n) => ({ n, text: verseByNumber(n) ? verseText(verseByNumber(n)!) : "" })).filter((v) => v.text);
  const reference = selected.length && currentBook ? `${currentBook.book} ${chapter}:${formatRanges(selected)}` : "";
  const copyBody = selectedTexts.length > 1
    ? selectedTexts.map((v) => `${v.n} ${v.text}`).join("\n")
    : selectedTexts[0]?.text ?? "";
  const searchPhrase = selectedTexts[0]?.text.split(/\s+/).slice(0, 6).join(" ") ?? "";
  const lastBook = lastRead ? books.find((b) => b.slug === lastRead.slug) : null;
  const continueLabel = lastBook && lastRead ? `${lastBook.book} ${lastRead.chapter}` : "";
  const showContinue = Boolean(lastBook && lastRead && (lastRead.slug !== bookSlug || lastRead.chapter !== chapter));

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
        {showContinue && <button type="button" className="cj-continue" onClick={() => go(lastRead!.slug, lastRead!.chapter)}>
          <small>CONTINUE READING</small><span>{continueLabel} →</span>
        </button>}
        <label className="cj-book-search"><span>›</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a book..." /></label>
        <div className="cj-testaments">
          {(["All", "Old Testament", "New Testament", "Apocrypha"] as Filter[]).map((item) =>
            <button type="button" key={item} className={filter === item ? "is-active" : ""} onClick={() => setFilter(item)}>{item === "All" ? "ALL" : item.split(" ")[0].slice(0, 3).toUpperCase()}</button>)}
        </div>
        <div className="cj-book-list">
          {filteredBooks.map((book) => {
            const readCount = (readMap[book.slug] ?? []).length;
            return <button type="button" key={book.slug} className={book.slug === bookSlug ? "is-active" : ""}
              onClick={() => go(book.slug, book.chapterIds[0])}>
              <span>{book.book}</span><small>{readCount ? `${readCount}/${book.chapters}` : book.chapters}</small>
              {readCount > 0 && <i className="cj-progress" style={{ width: `${Math.min(100, Math.round((readCount / book.chapters) * 100))}%` }} />}
            </button>;
          })}
        </div>
        {currentBook && <section className="cj-chapter-picker">
          <div><strong>{currentBook.book}</strong><small>{currentBook.testament}</small></div>
          <div className="cj-chapter-grid">{chapterIds.map((id) => <button type="button" key={id}
            className={`${id === chapter ? "is-active" : ""} ${(readMap[currentBook.slug] ?? []).includes(id) ? "is-read" : ""}`}
            onClick={() => go(currentBook.slug, id)}>{id}</button>)}</div>
        </section>}
        {bookmarks.length > 0 && <section className="cj-bookmarks">
          <div className="cj-related-head"><span>BOOKMARKS</span><b>{bookmarks.length}</b></div>
          {bookmarks.slice(0, 20).map((mark) => <div className="cj-bookmark-row" key={`${mark.slug}-${mark.chapter}-${mark.verse}`}>
            <a href={`${base}/bible/${mark.slug}/${mark.chapter}#v${mark.verse}`} onClick={(e) => { e.preventDefault(); go(mark.slug, mark.chapter, `#v${mark.verse}`); }}>
              <span>{mark.ref}</span><em>{mark.text}</em>
            </a>
            <button type="button" aria-label={`Remove bookmark ${mark.ref}`} onClick={() => {
              setBookmarks((prev) => { const next = prev.filter((b) => b !== mark); store.set("cj-bookmarks", next); return next; });
            }}>×</button>
          </div>)}
        </section>}
      </aside>

      <main className="cj-reading-pane">
        {currentBook && chapter !== undefined && <nav className="cj-readerbar" aria-label="Chapter controls">
          <button type="button" disabled={!previousTarget} onClick={() => previousTarget && go(previousTarget.slug, previousTarget.chapter)} aria-label="Previous chapter" title="Previous chapter (←)">‹</button>
          <label><span className="sr-only">Book</span><select value={bookSlug} onChange={(e) => { const book = books.find((b) => b.slug === e.target.value); if (book) go(book.slug, book.chapterIds[0]); }}>{books.map((book) => <option value={book.slug} key={book.slug}>{book.book}</option>)}</select></label>
          <label><span className="sr-only">Chapter</span><select value={chapter} onChange={(e) => go(currentBook.slug, Number(e.target.value))}>{chapterIds.map((id) => <option value={id} key={id}>Ch. {id}</option>)}</select></label>
          <button type="button" disabled={!nextTarget} onClick={() => nextTarget && go(nextTarget.slug, nextTarget.chapter)} aria-label="Next chapter" title="Next chapter (→)">›</button>
          <div className="cj-reader-size">{sizes.map((item) => <button type="button" key={item} className={size === item ? "is-active" : ""} onClick={() => { setSize(item); document.documentElement.dataset.readerSize = item; store.set("cj-reader-size", item); }}>{item === "compact" ? "A−" : item === "large" ? "A+" : "A"}</button>)}</div>
        </nav>}
        {!currentBook && <div className="cj-app-welcome"><span>READY</span><h1>Open the Scriptures</h1>
          <p>Search all 81 books, choose a chapter, then tap any verse to select, copy, link, highlight, bookmark, and explore every connected study record.</p>
          <div className="cj-welcome-actions">
            {lastBook && lastRead && <button type="button" onClick={() => go(lastRead.slug, lastRead.chapter)}>Continue: {continueLabel} →</button>}
            <button type="button" className={lastBook ? "cj-secondary" : ""} onClick={() => go("genesis", 1)}>Begin at Genesis 1 →</button>
          </div>
        </div>}
        <article ref={articleRef} className={`cj-reader-article ${!chapter ? "cj-reader-index" : ""}`}>{children}</article>
      </main>

      <aside className={`cj-study-tools ${toolsOpen ? "is-open" : ""}`} aria-label="Verse tools">
        <div className="cj-panel-title"><span>VERSE_TOOLS</span><button type="button" onClick={() => setToolsOpen(false)}>×</button></div>
        {selected.length && currentBook ? <>
          <div className="cj-selected-verse"><small>SELECTED</small><strong>{reference}</strong>
            <p>{selectedTexts.length > 1 ? `${selectedTexts.length} verses` : selectedTexts[0]?.text}</p>
          </div>
          <div className="cj-copy-actions">
            <button type="button" onClick={() => copy(`${reference} — ${copyBody}`, "verse")}>{copied === "verse" ? "✓ Copied" : selected.length > 1 ? "Copy verses" : "Copy verse"}</button>
            <button type="button" onClick={() => copy(window.location.href, "link")}>{copied === "link" ? "✓ Copied" : "Copy link"}</button>
            <button type="button" className={isBookmarked ? "is-active" : ""} onClick={toggleBookmark} title="Bookmark (b)">{isBookmarked ? "★ Bookmarked" : "☆ Bookmark"}</button>
          </div>
          <div className="cj-hl-row" role="group" aria-label="Highlight">
            <small>HIGHLIGHT</small>
            {HL_COLORS.map((color) => <button type="button" key={color} className={`cj-hl-dot cj-hl-dot-${color} ${firstSelected !== undefined && highlights[firstSelected] === color ? "is-active" : ""}`} aria-label={`Highlight ${color}`} onClick={() => applyHighlight(color)} />)}
            <button type="button" className="cj-hl-clear" onClick={() => applyHighlight(null)} aria-label="Clear highlight">×</button>
          </div>
          <div className="cj-verse-links">
            <a href={`${base}/search?q=${encodeURIComponent(`"${searchPhrase}"`)}`}>Search this phrase</a>
            <a href={`${base}/concordance/${bookSlug}`}>Book concordance</a>
          </div>
        </> : <div className="cj-tools-empty"><b>+</b><p>Select any verse in the text to open its actions and connected records. Shift-click selects a range; j and k move by verse.</p></div>}
        {currentBook && chapter !== undefined && <section className="cj-readaloud">
          <div className="cj-related-head"><span>READ_ALOUD</span></div>
          <div className="cj-readaloud-controls">
            {speechState === "idle"
              ? <button type="button" onClick={() => startReading(firstSelected)} title="Read aloud (p)">▶ {firstSelected !== undefined ? `Read from verse ${firstSelected}` : "Read chapter"}</button>
              : <>
                <button type="button" onClick={togglePause}>{speechState === "playing" ? "⏸ Pause" : "▶ Resume"}</button>
                <button type="button" onClick={stopReading}>■ Stop</button>
              </>}
          </div>
        </section>}
        {currentBook && chapter !== undefined && <section className="cj-related">
          <div className="cj-related-head"><span>{selected.length ? `LINKED TO ${selected.length > 1 ? "SELECTION" : `VERSE ${firstSelected}`}` : "CHAPTER RECORDS"}</span><b>{dedupedCitations.length}</b></div>
          {dedupedCitations.slice(0, 20).map((item) => <a key={`${item.kind}-${item.url}-${item.label}`} href={`${base}${item.url}`} title={summaries[item.url] ?? undefined}>
            <small>{item.kind}</small><span>{item.label}</span>{item.verses && <em>vv. {item.verses}</em>}
            {summaries[item.url] && <p className="cj-related-summary">{summaries[item.url]}</p>}
          </a>)}
          {dedupedCitations.length === 0 && <p className="cj-related-none">No verse-specific records found.</p>}
        </section>}
      </aside>
    </div>
  </div>;
}
