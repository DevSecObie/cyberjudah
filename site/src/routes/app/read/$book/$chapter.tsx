import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { Empty, Icon, Row, Section, Skeleton } from "@/components/app/ui";
import { api, type Citation } from "@/lib/api";
import { compressVerses } from "@/lib/cite";
import { KIND_LABEL, mergeCitations, shelf, verseCounts, verseNumbers } from "@/lib/refs";
import { haptic, prefs, sharePage, tg, useTelegramButtons } from "@/lib/telegram";

type Search = { v?: string };
const SIZES = ["compact", "regular", "large"] as const;
type Size = (typeof SIZES)[number];

export const Route = createFileRoute("/app/read/$book/$chapter")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    v: typeof s.v === "string" && /^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(s.v) ? s.v : typeof s.v === "number" && s.v > 0 ? String(s.v) : undefined,
  }),
  component: Reader,
});

function useSize(): [Size, () => void] {
  const [size, setSize] = useState<Size>("regular");
  useEffect(() => { prefs.get("reader-size", (s) => { if (s && SIZES.includes(s as Size)) setSize(s as Size); }); }, []);
  useEffect(() => {
    document.documentElement.setAttribute("data-reader-size", size);
    return () => document.documentElement.removeAttribute("data-reader-size");
  }, [size]);
  return [size, () => setSize((s) => { const n = SIZES[(SIZES.indexOf(s) + 1) % SIZES.length]; prefs.set("reader-size", n); haptic("select"); return n; })];
}

function Reader() {
  const { book: slug, chapter } = Route.useParams();
  const { v } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const ch = Number(chapter);
  const books = useQuery({ queryKey: ["books"], queryFn: api.books, staleTime: Infinity });
  const text = useQuery({ queryKey: ["chapter", slug, ch], queryFn: () => api.chapter(slug, ch), staleTime: Infinity });
  const cites = useQuery({ queryKey: ["cites", slug, ch], queryFn: () => api.concordance(slug, ch).then((c) => mergeCitations(c.cited_by)).catch(() => [] as Citation[]), staleTime: 5 * 60_000 });
  const [, cycleSize] = useSize();

  const list = books.data ?? [];
  const idx = list.findIndex((b) => b.slug === slug);
  const book = list[idx];
  const next = book && ch < book.chapters ? { slug, ch: ch + 1, name: `${book.book} ${ch + 1}` } : list[idx + 1] ? { slug: list[idx + 1].slug, ch: 1, name: `${list[idx + 1].book} 1` } : null;
  const prev = book && ch > 1 ? { slug, ch: ch - 1, name: `${book.book} ${ch - 1}` } : idx > 0 ? { slug: list[idx - 1].slug, ch: list[idx - 1].chapters, name: `${list[idx - 1].book} ${list[idx - 1].chapters}` } : null;
  const name = book ? `${book.book} ${ch}` : "";

  const selected = useMemo(() => verseNumbers(v).sort((a, b) => a - b), [v]);
  const counts = useMemo(() => verseCounts(cites.data ?? []), [cites.data]);
  const setVerses = (nums: number[]) => navigate({ to: "/app/read/$book/$chapter", params: { book: slug, chapter }, search: { v: nums.length ? compressVerses([...nums].sort((a, b) => a - b)) : undefined }, replace: true, resetScroll: false });
  const toggle = (n: number) => { haptic("select"); setVerses(selected.includes(n) ? selected.filter((x) => x !== n) : [...selected, n]); };
  const go = (to: { slug: string; ch: number } | null) => to && navigate({ to: "/app/read/$book/$chapter", params: { book: to.slug, chapter: String(to.ch) }, search: {} });

  // Where they left off, for Continue on the home screen (synced through Telegram).
  useEffect(() => { if (name) prefs.set("last-read", JSON.stringify({ slug, chapter: ch, name })); }, [slug, ch, name]);
  // A shared verse lands on the verse.
  useEffect(() => {
    if (!text.data || !selected.length) return;
    const t = window.setTimeout(() => document.getElementById(`v${selected[0]}`)?.scrollIntoView({ block: "start" }), 60);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text.data, slug, ch]);

  const passage = selected.length && name ? `${name}:${compressVerses(selected)}` : "";
  useTelegramButtons(
    passage ? { text: `Share ${passage}`, onClick: () => sharePage(compressVerses(selected), passage) }
      : next ? { text: `${next.name} →`, onClick: () => go(next) } : null,
    passage ? { text: "Clear", onClick: () => setVerses([]) }
      : prev ? { text: `← ${prev.name}`, onClick: () => go(prev) } : null,
  );

  const taught = (cites.data ?? []).filter((c) => !selected.length || verseNumbers(c.verses).some((n) => selected.includes(n)) || !c.verses);

  return (
    <main className="app-reader">
      <div className="app-reader__bar">
        {tg() ? <span style={{ width: 40 }} /> : <button type="button" className="app-icon-btn" aria-label="Back" onClick={() => (router.history.canGoBack() ? router.history.back() : navigate({ to: "/app/bible" }))}><Icon name="back" size={20} /></button>}
        <h1><Link to="/app/bible" search={{ book: slug }} replace>{name || " "}</Link></h1>
        <button type="button" className="app-icon-btn" aria-label="Text size" onClick={cycleSize}>Aa</button>
      </div>
      {text.isPending ? <Skeleton rows={8} /> : text.isError ? <Empty title="This chapter did not load">Check your connection and try again.</Empty> : (
        <div className="app-verses">
          {text.data.verses.map((row) => (
            <span key={row.verse} id={`v${row.verse}`} className="app-v" role="button" tabIndex={0} aria-pressed={selected.includes(row.verse)} data-cited={counts.get(row.verse) ? "" : undefined}
              onClick={() => { if (!window.getSelection()?.toString()) toggle(row.verse); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(row.verse); } }}>
              <sup>{row.verse}</sup>{row.text}
            </span>
          ))}
        </div>
      )}
      {taught.length ? (
        <div style={{ marginTop: 28 }}>
          <Section title={selected.length ? `Taught from ${passage}` : "Taught from this chapter"}>
            <div className="app-list">
              {taught.slice(0, 30).map((c) => <Row key={c.url + (c.verses ?? "")} href={c.url} meta={`${KIND_LABEL[shelf(c)] ?? "Note"}${c.verses ? ` · v. ${c.verses}` : ""}`} title={c.label} />)}
            </div>
          </Section>
        </div>
      ) : null}
      <nav className="app-steps" aria-label="Chapters">
        {prev ? <Link to="/app/read/$book/$chapter" params={{ book: prev.slug, chapter: String(prev.ch) }}>← {prev.name}</Link> : null}
        {next ? <Link data-main="" to="/app/read/$book/$chapter" params={{ book: next.slug, chapter: String(next.ch) }}>{next.name} →</Link> : null}
      </nav>
    </main>
  );
}
