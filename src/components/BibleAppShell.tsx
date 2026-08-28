import React, { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHistory } from "@docusaurus/router";
import useBaseUrl from "@docusaurus/useBaseUrl";
import booksData from "../../static/api/kjv/books.json";
import "../css/scripture-os.css";

type Book = { book: string; slug: string; testament: string; chapters: number; verses: number; chapterIds: number[] };
type Citation = { kind: string; label: string; url: string; verses: string };
type Filter = "All" | "Old Testament" | "New Testament" | "Apocrypha";
type ReaderSize = "compact" | "normal" | "large";
type ReaderTheme = "default" | "sepia" | "night";
type Bookmark = { slug: string; chapter: number; verse: number; ref: string; text: string };
type HighlightColor = "cyan" | "magenta" | "amber";
type XrefTarget = [string, number, number];
type Prefs = { theme: ReaderTheme; para: boolean; nums: boolean; parallel: boolean };

const books = booksData as Book[];
const sizes: ReaderSize[] = ["compact", "normal", "large"];
const HL_COLORS: HighlightColor[] = ["cyan", "magenta", "amber"];
const THEMES: ReaderTheme[] = ["default", "sepia", "night"];
const bookBySlug = new Map(books.map((b) => [b.slug, b]));
const PLAN_SIZE = 4; // 4 Chapters a Day

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

const dayStamp = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* module-level caches shared across chapter navigations */
let notesIndexPromise: Promise<Record<string, string>> | null = null;
const chapterTextCache = new Map<string, Promise<string[]>>();

export default function BibleAppShell({ bookSlug, chapter, children }: {
  bookSlug?: string; chapter?: number; children: ReactNode;
}) {
  const history = useHistory();
  const base = useBaseUrl("/").replace(/\/$/, "");
  const articleRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [size, setSize] = useState<ReaderSize>("normal");
  const [prefs, setPrefs] = useState<Prefs>({ theme: "default", para: false, nums: true, parallel: false });
  const [selected, setSelected] = useState<number[]>([]);
  const selectedRef = useRef<number[]>([]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  const anchorRef = useRef<number | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [xrefs, setXrefs] = useState<Record<string, XrefTarget[]>>({});
  const [xrefPreview, setXrefPreview] = useState<{ key: string; text: string } | null>(null);
  const [webVerses, setWebVerses] = useState<string[] | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [noteDraft, setNoteDraft] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [copied, setCopied] = useState("");
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [highlights, setHighlights] = useState<Record<number, HighlightColor>>({});
  const [readMap, setReadMap] = useState<Record<string, number[]>>({});
  const [lastRead, setLastRead] = useState<{ slug: string; chapter: number } | null>(null);
  const [planIndex, setPlanIndex] = useState<number | null>(null);
  const [streak, setStreak] = useState<{ date: string; count: number }>({ date: "", count: 0 });
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
  const verseText = (node: HTMLElement) => {
    const clone = node.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".cj-web-inline, .cj-note-tip").forEach((el) => el.remove());
    return clone.textContent?.replace(/^\s*\d+\s*/, "").trim() ?? "";
  };
  const verseByNumber = (n: number) => articleRef.current?.querySelector<HTMLElement>(`.scripture .verse#v${n}`) ?? null;
  const fetchChapterText = useCallback((slug: string, ch: number): Promise<string[]> => {
    const key = `${slug}/${ch}`;
    if (!chapterTextCache.has(key)) {
      chapterTextCache.set(key, fetch(`${base}/api/kjv/${slug}/${ch}.json`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data: { verses: { verse: number; text: string }[] }) => {
          const out: string[] = [];
          for (const v of data.verses) out[v.verse] = v.text;
          return out;
        }).catch(() => []));
    }
    return chapterTextCache.get(key)!;
  }, [base]);

  /* every chapter of the canon in order, for the 4 Chapters a Day plan */
  const flatChapters = useMemo(() => books.flatMap((b) => b.chapterIds.map((c) => ({ slug: b.slug, chapter: c, label: `${b.book} ${c}` }))), []);

  const applyPrefs = (next: Prefs) => {
    setPrefs(next); store.set("cj-reader-prefs", next);
    document.documentElement.dataset.readerTheme = next.theme;
    document.documentElement.dataset.readerPara = next.para ? "true" : "false";
    document.documentElement.dataset.readerNums = next.nums ? "true" : "false";
  };

  /* boot: size, prefs, memory, plan, streak */
  useEffect(() => {
    document.documentElement.dataset.bibleApp = "true";
    const stored = store.getRaw("cj-reader-size")?.replace(/"/g, "") as ReaderSize | undefined;
    const initial = stored && sizes.includes(stored) ? stored : "normal";
    setSize(initial); document.documentElement.dataset.readerSize = initial;
    applyPrefs({ theme: "default", para: false, nums: true, parallel: false, ...store.get<Partial<Prefs>>("cj-reader-prefs", {}) });
    setBookmarks(store.get<Bookmark[]>("cj-bookmarks", []));
    const read = store.get<Record<string, number[]>>("cj-read", {});
    setReadMap(read);
    setPlanIndex(store.get<number | null>("cj-plan-index", null));
    const last = store.getRaw("cj-last-chapter")?.replace(/"/g, "");
    if (last) { const [slug, ch] = last.split("/"); if (slug && ch) setLastRead({ slug, chapter: Number(ch) }); }
    const st = store.get<{ date: string; count: number }>("cj-streak", { date: "", count: 0 });
    if (bookSlug && chapter !== undefined) {
      try { window.localStorage.setItem("cj-last-chapter", `${bookSlug}/${chapter}`); } catch { /* best effort */ }
      setLastRead({ slug: bookSlug, chapter });
      const chapters = new Set(read[bookSlug] ?? []);
      if (!chapters.has(chapter)) {
        chapters.add(chapter);
        const nextMap = { ...read, [bookSlug]: [...chapters].sort((a, b) => a - b) };
        store.set("cj-read", nextMap); setReadMap(nextMap);
      }
      const today = dayStamp();
      if (st.date !== today) {
        const yesterday = dayStamp(new Date(Date.now() - 86400000));
        const next = { date: today, count: st.date === yesterday ? st.count + 1 : 1 };
        store.set("cj-streak", next); setStreak(next);
      } else setStreak(st);
    } else setStreak(st);
    return () => {
      delete document.documentElement.dataset.bibleApp; delete document.documentElement.dataset.readerSize;
      delete document.documentElement.dataset.readerTheme; delete document.documentElement.dataset.readerPara; delete document.documentElement.dataset.readerNums;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookSlug, chapter]);

  /* plan auto-advance: once every chapter of the current block is read, move to the next block */
  useEffect(() => {
    if (planIndex === null) return;
    let i = planIndex;
    while (i < flatChapters.length && flatChapters.slice(i, i + PLAN_SIZE).every((c) => (readMap[c.slug] ?? []).includes(c.chapter))) i += PLAN_SIZE;
    if (i !== planIndex) { setPlanIndex(i); store.set("cj-plan-index", i); }
  }, [planIndex, readMap, flatChapters]);

  /* per-chapter: citations, xrefs, WEB text, notes, highlights, hash selection */
  useEffect(() => {
    setSelected([]); anchorRef.current = null; setCopied(""); setXrefPreview(null); setNoteOpen(false);
    stopReading();
    if (!bookSlug || chapter === undefined) { setCitations([]); setHighlights({}); setXrefs({}); setWebVerses(null); setNotes({}); return; }
    setHighlights(store.get<Record<string, Record<number, HighlightColor>>>("cj-highlights", {})[`${bookSlug}/${chapter}`] ?? {});
    setNotes(store.get<Record<string, Record<number, string>>>("cj-notes", {})[`${bookSlug}/${chapter}`] ?? {});
    const hashVerse = /^#v(\d+)$/.exec(window.location.hash)?.[1];
    if (hashVerse) { setSelected([Number(hashVerse)]); anchorRef.current = Number(hashVerse); }
    fetch(`${base}/api/concordance/${bookSlug}/${chapter}.json`)
      .then((r) => r.ok ? r.json() : Promise.reject()).then((data) => setCitations(data.cited_by ?? [])).catch(() => setCitations([]));
    fetch(`${base}/api/xref/${bookSlug}/${chapter}.json`)
      .then((r) => r.ok ? r.json() : Promise.reject()).then(setXrefs).catch(() => setXrefs({}));
    fetch(`${base}/api/web/${bookSlug}/${chapter}.json`)
      .then((r) => r.ok ? r.json() : Promise.reject()).then(setWebVerses).catch(() => setWebVerses(null));
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
      setSelected(next); setXrefPreview(null); setNoteOpen(false);
      if (next.length) {
        setToolsOpen(true);
        history.replace(`${window.location.pathname}${window.location.search}#v${next[0]}`);
      }
    };
    verses.forEach((verse) => verse.addEventListener("click", select));
    return () => verses.forEach((verse) => verse.removeEventListener("click", select));
  }, [chapter, history]);

  /* parallel mode: interleave the WEB rendering under each KJV verse */
  useEffect(() => {
    if (chapter === undefined) return;
    const nodes = verseNodes();
    for (const node of nodes) {
      const existing = node.querySelector(".cj-web-inline");
      if (existing) existing.remove();
      if (prefs.parallel && webVerses) {
        const n = Number(node.id.replace("v", ""));
        const text = webVerses[n - 1];
        if (text) {
          const div = document.createElement("span");
          div.className = "cj-web-inline";
          div.textContent = text;
          node.appendChild(div);
        }
      }
    }
    return () => { for (const node of nodes) node.querySelector(".cj-web-inline")?.remove(); };
  }, [prefs.parallel, webVerses, chapter, children]);

  /* sync DOM classes with state */
  useEffect(() => {
    if (chapter === undefined) return;
    const marked = new Set(bookmarks.filter((b) => b.slug === bookSlug && b.chapter === chapter).map((b) => b.verse));
    for (const node of verseNodes()) {
      const n = Number(node.id.replace("v", ""));
      node.classList.toggle("is-selected", selected.includes(n));
      node.classList.toggle("is-reading", readingVerse === n);
      node.classList.toggle("is-bookmarked", marked.has(n));
      node.classList.toggle("is-noted", Boolean(notes[n]));
      const tip = node.querySelector<HTMLElement>(".cj-note-tip");
      if (notes[n]) {
        if (tip) { if (tip.textContent !== notes[n]) tip.textContent = notes[n]; }
        else { const el = document.createElement("span"); el.className = "cj-note-tip"; el.textContent = notes[n]; node.appendChild(el); }
      } else tip?.remove();
      for (const color of HL_COLORS) node.classList.toggle(`cj-hl-${color}`, highlights[n] === color);
    }
  }, [selected, highlights, bookmarks, notes, readingVerse, bookSlug, chapter, children]);

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

  /* bookmarks, highlights, notes */
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
  const saveNote = useCallback((text: string) => {
    if (!bookSlug || chapter === undefined || firstSelected === undefined) return;
    setNotes((prev) => {
      const next = { ...prev };
      if (text.trim()) next[firstSelected] = text.trim(); else delete next[firstSelected];
      const all = store.get<Record<string, Record<number, string>>>("cj-notes", {});
      if (Object.keys(next).length) all[`${bookSlug}/${chapter}`] = next; else delete all[`${bookSlug}/${chapter}`];
      store.set("cj-notes", all);
      return next;
    });
    setNoteOpen(false);
  }, [bookSlug, chapter, firstSelected]);

  /* shareable verse image (canvas, downloads a PNG) */
  const shareImage = useCallback(async () => {
    if (!currentBook || chapter === undefined || !selected.length) return;
    const texts = selected.map((n) => (verseByNumber(n) ? verseText(verseByNumber(n)!) : "")).filter(Boolean);
    let passage = texts.join(" ");
    if (passage.length > 420) passage = passage.slice(0, 417).replace(/\s+\S*$/, "") + "…";
    const ref = `${currentBook.book} ${chapter}:${formatRanges(selected)}`;
    const canvas = document.createElement("canvas");
    canvas.width = 1080; canvas.height = 1080;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#05070f"; ctx.fillRect(0, 0, 1080, 1080);
    ctx.strokeStyle = "rgba(0,229,255,.06)"; ctx.lineWidth = 1;
    for (let x = 0; x <= 1080; x += 54) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1080); ctx.stroke(); }
    for (let y = 0; y <= 1080; y += 54) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1080, y); ctx.stroke(); }
    try {
      const lion = new Image();
      lion.src = `${base}/img/cyber-lion.png`;
      await new Promise<void>((resolve) => { lion.onload = () => resolve(); lion.onerror = () => resolve(); });
      if (lion.complete && lion.naturalWidth) { ctx.globalAlpha = 0.18; ctx.drawImage(lion, 1080 - 560, 1080 - 620, 560, 580); ctx.globalAlpha = 1; }
    } catch { /* decorative only */ }
    const fontSize = passage.length > 260 ? 40 : passage.length > 140 ? 48 : 58;
    ctx.font = `600 ${fontSize}px Newsreader, Georgia, serif`;
    ctx.fillStyle = "#f2f6fb"; ctx.textBaseline = "top";
    const words = passage.split(" "); const lines: string[] = []; let line = "";
    for (const word of words) {
      const probe = line ? `${line} ${word}` : word;
      if (ctx.measureText(probe).width > 880) { lines.push(line); line = word; } else line = probe;
    }
    if (line) lines.push(line);
    const lineHeight = fontSize * 1.42;
    let y = Math.max(140, (1080 - lines.length * lineHeight) / 2 - 60);
    for (const l of lines) { ctx.fillText(l, 100, y); y += lineHeight; }
    ctx.font = "700 34px 'JetBrains Mono', monospace"; ctx.fillStyle = "#00e5ff";
    ctx.fillText(ref.toUpperCase(), 100, y + 30);
    ctx.font = "700 26px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#ff2d78"; ctx.fillText("[", 100, 1080 - 90);
    ctx.fillStyle = "#00e5ff"; ctx.fillText(" cyberjudah ", 100 + ctx.measureText("[").width, 1080 - 90);
    ctx.fillStyle = "#ff2d78"; ctx.fillText("]", 100 + ctx.measureText("[ cyberjudah ").width, 1080 - 90);
    const link = document.createElement("a");
    link.download = `${ref.replace(/[^\w]+/g, "-").toLowerCase()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [base, chapter, currentBook, selected]);

  /* keyboard: arrows chapters, j/k verses, b bookmark, h highlight, p read, Esc clear */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, select, textarea, [contenteditable]") || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "Escape") { setSelected([]); setLibraryOpen(false); setToolsOpen(false); setNoteOpen(false); stopReading(); return; }
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

  const selectedXrefs = useMemo(() => {
    if (firstSelected === undefined) return [];
    return (xrefs[String(firstSelected)] ?? []).filter(([slug]) => bookBySlug.has(slug));
  }, [xrefs, firstSelected]);

  const previousTarget = chapterIndex > 0 ? { slug: bookSlug!, chapter: chapterIds[chapterIndex - 1] }
    : currentIndex > 0 && chapter !== undefined ? { slug: books[currentIndex - 1].slug, chapter: books[currentIndex - 1].chapterIds.at(-1)! } : null;
  const nextTarget = chapterIndex >= 0 && chapterIndex < chapterIds.length - 1 ? { slug: bookSlug!, chapter: chapterIds[chapterIndex + 1] }
    : currentIndex >= 0 && currentIndex < books.length - 1 && chapter !== undefined ? { slug: books[currentIndex + 1].slug, chapter: books[currentIndex + 1].chapterIds[0] } : null;

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value); setCopied(label); window.setTimeout(() => setCopied(""), 1500);
  };
  const selectedTexts = selected.map((n) => ({ n, text: verseByNumber(n) ? verseText(verseByNumber(n)!) : "" })).filter((v) => v.text);
  const reference = selected.length && currentBook ? `${currentBook.book} ${chapter}:${formatRanges(selected)}` : "";
  const copyBody = selectedTexts.length > 1 ? selectedTexts.map((v) => `${v.n} ${v.text}`).join("\n") : selectedTexts[0]?.text ?? "";
  const searchPhrase = selectedTexts[0]?.text.split(/\s+/).slice(0, 6).join(" ") ?? "";
  const lastBook = lastRead ? bookBySlug.get(lastRead.slug) : null;
  const continueLabel = lastBook && lastRead ? `${lastBook.book} ${lastRead.chapter}` : "";
  const showContinue = Boolean(lastBook && lastRead && (lastRead.slug !== bookSlug || lastRead.chapter !== chapter));
  const todaysReading = planIndex !== null ? flatChapters.slice(planIndex, planIndex + PLAN_SIZE) : [];
  const planDay = planIndex !== null ? Math.floor(planIndex / PLAN_SIZE) + 1 : 0;
  const existingNote = firstSelected !== undefined ? notes[firstSelected] ?? "" : "";
  const webSelection = webVerses && selectedTexts.length
    ? selectedTexts.map((v) => ({ n: v.n, text: webVerses[v.n - 1] ?? "" })).filter((v) => v.text) : [];

  const cyclePref = () => {
    const next = THEMES[(THEMES.indexOf(prefs.theme) + 1) % THEMES.length];
    applyPrefs({ ...prefs, theme: next });
  };

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
        {streak.count > 1 && <div className="cj-streak" title="Consecutive days reading"><b>{streak.count}</b> day streak</div>}
        {showContinue && <button type="button" className="cj-continue" onClick={() => go(lastRead!.slug, lastRead!.chapter)}>
          <small>CONTINUE READING</small><span>{continueLabel} →</span>
        </button>}
        <section className="cj-plan">
          <div className="cj-related-head"><span>4 CHAPTERS A DAY</span>{planIndex !== null && <b>DAY {planDay}</b>}</div>
          {planIndex === null
            ? <button type="button" className="cj-plan-start" onClick={() => { setPlanIndex(0); store.set("cj-plan-index", 0); }}>Start the plan → Genesis 1</button>
            : <div className="cj-plan-list">
              {todaysReading.map((item) => {
                const done = (readMap[item.slug] ?? []).includes(item.chapter);
                return <button type="button" key={`${item.slug}-${item.chapter}`} className={done ? "is-done" : ""} onClick={() => go(item.slug, item.chapter)}>
                  <span>{done ? "✓" : "○"}</span>{item.label}
                </button>;
              })}
            </div>}
        </section>
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
          <div className="cj-reader-size">
            {sizes.map((item) => <button type="button" key={item} className={size === item ? "is-active" : ""} onClick={() => { setSize(item); document.documentElement.dataset.readerSize = item; store.set("cj-reader-size", item); }}>{item === "compact" ? "A−" : item === "large" ? "A+" : "A"}</button>)}
            <button type="button" className={prefs.para ? "is-active" : ""} title="Paragraph mode" onClick={() => applyPrefs({ ...prefs, para: !prefs.para })}>¶</button>
            <button type="button" className={!prefs.nums ? "is-active" : ""} title="Hide verse numbers" onClick={() => applyPrefs({ ...prefs, nums: !prefs.nums })}>№</button>
            <button type="button" className={prefs.theme !== "default" ? "is-active" : ""} title={`Reader theme: ${prefs.theme}`} onClick={cyclePref}>◐</button>
            <button type="button" className={prefs.parallel ? "is-active" : ""} title="Parallel view: KJV + World English Bible" onClick={() => applyPrefs({ ...prefs, parallel: !prefs.parallel })}>⇄</button>
          </div>
        </nav>}
        {!currentBook && <div className="cj-app-welcome"><span>READY</span><h1>Open the Scriptures</h1>
          <p>Search all 81 books, choose a chapter, then tap any verse to select, copy, link, highlight, bookmark, note, and trace every cross reference and study record connected to it.</p>
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
            <button type="button" onClick={shareImage} title="Download a shareable verse image">⇩ Verse image</button>
          </div>
          <div className="cj-hl-row" role="group" aria-label="Highlight">
            <small>HIGHLIGHT</small>
            {HL_COLORS.map((color) => <button type="button" key={color} className={`cj-hl-dot cj-hl-dot-${color} ${firstSelected !== undefined && highlights[firstSelected] === color ? "is-active" : ""}`} aria-label={`Highlight ${color}`} onClick={() => applyHighlight(color)} />)}
            <button type="button" className="cj-hl-clear" onClick={() => applyHighlight(null)} aria-label="Clear highlight">×</button>
          </div>
          <section className="cj-note">
            <div className="cj-related-head"><span>MY NOTE</span></div>
            {noteOpen
              ? <div className="cj-note-edit">
                <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={4} placeholder={`A note on ${currentBook.book} ${chapter}:${firstSelected}...`} />
                <div><button type="button" onClick={() => saveNote(noteDraft)}>Save</button><button type="button" className="cj-secondary" onClick={() => setNoteOpen(false)}>Cancel</button></div>
              </div>
              : existingNote
                ? <button type="button" className="cj-note-view" onClick={() => { setNoteDraft(existingNote); setNoteOpen(true); }}><p>{existingNote}</p><small>Edit note</small></button>
                : <button type="button" className="cj-note-add" onClick={() => { setNoteDraft(""); setNoteOpen(true); }}>✎ Add a note on verse {firstSelected}</button>}
          </section>
          {webSelection.length > 0 && <section className="cj-compare">
            <div className="cj-related-head"><span>COMPARE · WEB</span></div>
            <div className="cj-compare-body">
              {webSelection.map((v) => <p key={v.n}><b>{v.n}</b> {v.text}</p>)}
            </div>
          </section>}
          {selectedXrefs.length > 0 && <section className="cj-xrefs">
            <div className="cj-related-head"><span>CROSS REFERENCES · VERSE {firstSelected}</span><b>{selectedXrefs.length}</b></div>
            {selectedXrefs.map(([slug, ch, v]) => {
              const book = bookBySlug.get(slug)!;
              const key = `${slug}/${ch}/${v}`;
              const open = xrefPreview?.key === key;
              return <div key={key} className="cj-xref">
                <button type="button" className={open ? "is-open" : ""} onClick={() => {
                  if (open) { setXrefPreview(null); return; }
                  setXrefPreview({ key, text: "…" });
                  fetchChapterText(slug, ch).then((verses) => setXrefPreview((cur) => cur?.key === key ? { key, text: verses[v] ?? "" } : cur));
                }}>{book.book} {ch}:{v}</button>
                {open && <div className="cj-xref-preview">
                  <p>{xrefPreview.text}</p>
                  <a href={`${base}/bible/${slug}/${ch}#v${v}`} onClick={(e) => { e.preventDefault(); go(slug, ch, `#v${v}`); }}>Open →</a>
                </div>}
              </div>;
            })}
          </section>}
          <div className="cj-verse-links">
            <a href={`${base}/search?q=${encodeURIComponent(`"${searchPhrase}"`)}`}>Search this phrase</a>
            <a href={`${base}/concordance/${bookSlug}`}>Book concordance</a>
          </div>
        </> : <div className="cj-tools-empty"><b>+</b><p>Select any verse in the text to open its actions, cross references, and connected records. Shift-click selects a range; j and k move by verse.</p></div>}
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
