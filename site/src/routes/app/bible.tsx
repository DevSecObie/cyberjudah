import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { Empty, Icon, Screen, Segmented, Skeleton } from "@/components/app/ui";
import { api } from "@/lib/api";
import { haptic, prefs } from "@/lib/telegram";

type Part = "Old Testament" | "New Testament" | "Apocrypha";
const PARTS: [Part, string][] = [["Old Testament", "Old"], ["New Testament", "New"], ["Apocrypha", "Apocrypha"]];

export const Route = createFileRoute("/app/bible")({
  validateSearch: (s: Record<string, unknown>): { book?: string } => ({ book: typeof s.book === "string" && /^[a-z0-9-]+$/.test(s.book) ? s.book : undefined }),
  component: Bible,
});

function Bible() {
  const { book: open } = Route.useSearch();
  const navigate = useNavigate();
  const books = useQuery({ queryKey: ["books"], queryFn: api.books, staleTime: Infinity });
  const [part, setPart] = useState<Part>("Old Testament");
  const [last, setLast] = useState<{ slug: string; chapter: number } | null>(null);
  useEffect(() => { prefs.get("last-read", (v) => { try { const p = v ? JSON.parse(v) : null; if (p?.slug) setLast(p); } catch { /* ignore */ } }); }, []);
  // Opening a book from a link lands on its testament.
  useEffect(() => {
    const b = books.data?.find((x) => x.slug === open);
    if (b) setPart(b.testament as Part);
  }, [open, books.data]);
  useEffect(() => { if (open) document.getElementById(`book-${open}`)?.scrollIntoView({ block: "start" }); }, [open, part]);
  const list = useMemo(() => (books.data ?? []).filter((b) => b.testament === part), [books.data, part]);
  const toggle = (slug: string) => { haptic("select"); navigate({ to: "/app/bible", search: { book: open === slug ? undefined : slug }, replace: true, resetScroll: false }); };

  return (
    <Screen title="Bible" kicker="King James Version · 1769">
      <Segmented label="Testament" value={part} onChange={setPart} options={PARTS} />
      {books.isPending ? <Skeleton rows={10} /> : books.isError ? <Empty title="The books did not load">Check your connection and try again.</Empty> : (
        <div className="app-list">
          {list.map((b) => (
            <div key={b.slug} id={`book-${b.slug}`} style={{ scrollMarginTop: 12 }}>
              <button type="button" className="app-row" aria-expanded={open === b.slug} onClick={() => toggle(b.slug)}>
                <span className="app-row__body"><span className="app-row__title">{b.book}</span></span>
                <span className="app-row__count">{b.chapterIds.length}</span>
                <span className="app-row__chev" style={{ transform: open === b.slug ? "rotate(90deg)" : undefined, transition: "transform .15s" }}><Icon name="chevron" size={18} /></span>
              </button>
              {open === b.slug ? (
                <div className="app-chapters">
                  {b.chapterIds.map((c) => (
                    <Link key={c} to="/app/read/$book/$chapter" params={{ book: b.slug, chapter: String(c) }} data-last={last?.slug === b.slug && last.chapter === c ? "" : undefined} aria-label={`${b.book} ${c}`}>{c}</Link>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Screen>
  );
}
