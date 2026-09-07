import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Dialog } from "radix-ui";
import { Group, Panel, Separator } from "react-resizable-panels";

import { SiteNav, SiteFooter } from "@/components/site/chrome";
import { StudyPanel } from "@/components/site/study-panel";
import { api, type Citation } from "@/lib/api";
import { mergeCitations, verseCounts, type Ref } from "@/lib/refs";

type Search = { study?: string; v?: number };

export const Route = createFileRoute("/bible/$book/$chapter")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    study: typeof s.study === "string" && s.study.startsWith("/") ? s.study : undefined,
    v: Number.isInteger(Number(s.v)) && Number(s.v) > 0 ? Number(s.v) : undefined,
  }),
  loader: async ({ params }) => {
    const ch = Number(params.chapter);
    if (!Number.isInteger(ch) || ch < 1) throw notFound();
    const books = await api.books();
    const book = books.find((b) => b.slug === params.book);
    if (!book || !book.chapterIds.includes(ch)) throw notFound();
    const [chapter, concordance] = await Promise.all([
      api.chapter(book.slug, ch),
      api.concordance(book.slug, ch).catch(() => ({ cited_by: [] as Citation[] })),
    ]);
    return { books, book, chapter, cited: mergeCitations(concordance.cited_by) };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.book.book} ${loaderData.chapter.chapter} · CyberJudah` : "CyberJudah" },
      { name: "description", content: loaderData ? `${loaderData.book.book} ${loaderData.chapter.chapter}, King James Version, with everything taught from it.` : "" },
    ],
  }),
  component: ChapterPage,
});

const SIZES = ["compact", "regular", "large"] as const;
type Size = (typeof SIZES)[number];

function useReaderSize(): [Size, () => void] {
  const [size, setSize] = useState<Size>("regular");
  useEffect(() => {
    try {
      const s = window.localStorage.getItem("cj-reader-size") as Size | null;
      if (s && SIZES.includes(s)) setSize(s);
    } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute("data-reader-size", size);
    return () => document.documentElement.removeAttribute("data-reader-size");
  }, [size]);
  const cycle = () => setSize((s) => {
    const n = SIZES[(SIZES.indexOf(s) + 1) % SIZES.length];
    try { window.localStorage.setItem("cj-reader-size", n); } catch { /* ignore */ }
    return n;
  });
  return [size, cycle];
}

function ChapterPage() {
  const { books, book, chapter, cited } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const ch = chapter.chapter;
  const prev = ch > 1 ? ch - 1 : null;
  const next = ch < book.chapters ? ch + 1 : null;
  const bookIdx = books.findIndex((b) => b.slug === book.slug);
  const prevBook = !prev && bookIdx > 0 ? books[bookIdx - 1] : null;
  const nextBook = !next && bookIdx < books.length - 1 ? books[bookIdx + 1] : null;
  const counts = useMemo(() => verseCounts(cited), [cited]);
  const [size, cycleSize] = useReaderSize();
  const [sheet, setSheet] = useState(false);
  const [wide, setWide] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1100px)");
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Panel state lives in the URL, so it survives moving between chapters and can be shared.
  const setStudy = (study: string | undefined) =>
    navigate({ to: "/bible/$book/$chapter", params: { book: book.slug, chapter: String(ch) }, search: { ...search, study }, replace: true, resetScroll: false });
  const setVerse = (v: number | undefined) =>
    navigate({ to: "/bible/$book/$chapter", params: { book: book.slug, chapter: String(ch) }, search: { ...search, v, study: undefined }, replace: true, resetScroll: false });
  const goRef = (ref: Ref) =>
    navigate({ to: "/bible/$book/$chapter", params: { book: ref.slug, chapter: String(ref.chapter) }, search: { study: search.study, v: ref.verse }, hash: ref.verse ? `v${ref.verse}` : undefined });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.key === "ArrowRight" && (next || nextBook)) navigate({ to: "/bible/$book/$chapter", params: next ? { book: book.slug, chapter: String(next) } : { book: nextBook!.slug, chapter: "1" }, search: { study: search.study } });
      if (e.key === "ArrowLeft" && (prev || prevBook)) navigate({ to: "/bible/$book/$chapter", params: prev ? { book: book.slug, chapter: String(prev) } : { book: prevBook!.slug, chapter: String(prevBook!.chapters) }, search: { study: search.study } });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [book.slug, next, prev, nextBook, prevBook, navigate, search.study]);

  const keep = { study: search.study };
  const bar = (
    <div className="reader__bar">
      {prev ? <Link className="reader__step" to="/bible/$book/$chapter" params={{ book: book.slug, chapter: String(prev) }} search={keep} aria-label="Previous chapter">←</Link>
        : prevBook ? <Link className="reader__step" to="/bible/$book/$chapter" params={{ book: prevBook.slug, chapter: String(prevBook.chapters) }} search={keep} aria-label={`Back to ${prevBook.book}`}>←</Link>
        : <span className="reader__step" aria-disabled="true">←</span>}
      <select value={book.slug} aria-label="Book" onChange={(e) => navigate({ to: "/bible/$book/$chapter", params: { book: e.target.value, chapter: "1" }, search: keep })}>
        {books.map((b) => <option key={b.slug} value={b.slug}>{b.book}</option>)}
      </select>
      <select value={String(ch)} aria-label="Chapter" onChange={(e) => navigate({ to: "/bible/$book/$chapter", params: { book: book.slug, chapter: e.target.value }, search: keep })}>
        {book.chapterIds.map((c) => <option key={c} value={String(c)}>Chapter {c}</option>)}
      </select>
      {next ? <Link className="reader__step" to="/bible/$book/$chapter" params={{ book: book.slug, chapter: String(next) }} search={keep} aria-label="Next chapter">→</Link>
        : nextBook ? <Link className="reader__step" to="/bible/$book/$chapter" params={{ book: nextBook.slug, chapter: "1" }} search={keep} aria-label={`On to ${nextBook.book}`}>→</Link>
        : <span className="reader__step" aria-disabled="true">→</span>}
      <button type="button" className="reader__tool" onClick={cycleSize} aria-label={`Text size: ${size}`} title="Text size">Aa</button>
      {!wide ? (
        <button type="button" className="reader__tool reader__tool--study" onClick={() => setSheet(true)} aria-label="Open the study panel">
          Study{cited.length ? <b>{cited.length}</b> : null}
        </button>
      ) : null}
    </div>
  );

  const text = (
    <article className="reader__text">
      {bar}
      <p className="cj-kicker">{book.testament}</p>
      <h1 className="cj-h1">{book.book} {ch}</h1>
      <div className="verses">
        {chapter.verses.map((v) => {
          const n = counts.get(v.verse) ?? 0;
          const active = search.v === v.verse;
          return (
            <p key={v.verse} className="verse" id={`v${v.verse}`} data-cited={n ? "" : undefined} data-active={active ? "" : undefined}>
              <a className="verse__n" href={`#v${v.verse}`} onClick={(e) => { e.preventDefault(); setVerse(active ? undefined : v.verse); if (!wide && !active && n) setSheet(true); }} title={n ? `${n} ${n === 1 ? "citation" : "citations"} name this verse` : undefined}>
                {v.verse}
              </a>
              {v.text}
              {n ? <span className="verse__mark" aria-hidden="true">{n}</span> : null}
            </p>
          );
        })}
      </div>
      <nav className="reader__foot" aria-label="Chapter navigation">
        {prev ? <Link className="read-link" to="/bible/$book/$chapter" params={{ book: book.slug, chapter: String(prev) }} search={keep}><span>{book.book} {prev}</span></Link>
          : prevBook ? <Link className="read-link" to="/bible/$book/$chapter" params={{ book: prevBook.slug, chapter: String(prevBook.chapters) }} search={keep}><span>{prevBook.book} {prevBook.chapters}</span></Link> : <span />}
        {next ? <Link className="read-link" to="/bible/$book/$chapter" params={{ book: book.slug, chapter: String(next) }} search={keep}><span>{book.book} {next}</span><span aria-hidden="true">→</span></Link>
          : nextBook ? <Link className="read-link" to="/bible/$book/$chapter" params={{ book: nextBook.slug, chapter: "1" }} search={keep}><span>{nextBook.book} 1</span><span aria-hidden="true">→</span></Link> : <span />}
      </nav>
    </article>
  );

  const panel = (
    <StudyPanel books={books} citations={cited} activeVerse={search.v} study={search.study} onStudy={setStudy} onVerse={setVerse} onGo={goRef} compact={!wide} />
  );

  return (
    <div className="cj-shell">
      <SiteNav />
      <main className="reader-page">
        <nav className="reader__rail" aria-label="Books">
          {books.map((b) => (
            <Link key={b.slug} to="/bible/$book/$chapter" params={{ book: b.slug, chapter: "1" }} search={keep} aria-current={b.slug === book.slug ? "page" : undefined}>{b.book}</Link>
          ))}
        </nav>
        {wide ? (
          <Group orientation="horizontal" className="reader__split">
            <Panel defaultSize="62%" minSize="40%" className="reader__pane">{text}</Panel>
            <Separator className="reader__handle" aria-label="Resize the study panel" />
            <Panel defaultSize="38%" minSize="22%" maxSize="55%" className="reader__pane reader__pane--study">
              <div className="reader__sticky">{panel}</div>
            </Panel>
          </Group>
        ) : (
          <div className="reader__split reader__split--single">{text}</div>
        )}
      </main>
      {!wide ? (
        <Dialog.Root open={sheet} onOpenChange={setSheet}>
          <Dialog.Portal>
            <Dialog.Overlay className="sheet__overlay" />
            <Dialog.Content className="sheet" aria-describedby={undefined}>
              <Dialog.Title className="sheet__title">Study</Dialog.Title>
              <Dialog.Close className="sheet__close" aria-label="Close">×</Dialog.Close>
              {panel}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      ) : null}
      <SiteFooter />
    </div>
  );
}
