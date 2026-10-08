import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Empty, Icon, Row, Screen, SearchField, Section, Segmented, Skeleton, openVideo, timestamp, when } from "@/components/app/ui";
import { SearchHighlight } from "@/components/search-highlight";
import { searchLibrary } from "@/lib/search";
import { searchTeachings } from "@/lib/teachings";
import { prefs } from "@/lib/telegram";

type Mode = "library" | "said";
type Search = { q: string; mode: Mode; only?: string };

export const Route = createFileRoute("/app/search")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === "string" ? s.q.slice(0, 200) : "",
    mode: s.mode === "said" ? "said" : "library",
    only: typeof s.only === "string" && s.only ? s.only : undefined,
  }),
  component: SearchScreen,
});

const KIND_LABEL: Record<string, string> = { verse: "Scripture", law: "Laws", precept: "Precepts", case: "Case studies", study: "Study notes", class: "Sabbath classes", captains: "15 Min w/ Captains", history: "Our Hidden History", encyclopedia: "Encyclopedia" };
const KIND_ORDER = ["verse", "class", "captains", "history", "study", "law", "precept", "case", "encyclopedia"];
const EXAMPLES = ["Passover", "Sabbath", "Melchizedek", "usury", "Ezekiel 37", "\"seventh day\"", "the twelve tribes"];

function useRecent(): [string[], (q: string) => void] {
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => { prefs.get("recent-searches", (v) => { try { const a = v ? JSON.parse(v) : []; if (Array.isArray(a)) setRecent(a.filter((x) => typeof x === "string").slice(0, 8)); } catch { /* ignore */ } }); }, []);
  const add = (q: string) => setRecent((r) => {
    const next = [q, ...r.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 8);
    prefs.set("recent-searches", JSON.stringify(next));
    return next;
  });
  return [recent, add];
}

function SearchScreen() {
  const { q, mode, only } = Route.useSearch();
  const navigate = useNavigate();
  const [input, setInput] = useState(q);
  const [recent, remember] = useRecent();
  useEffect(() => { setInput(q); }, [q]);
  const set = (patch: Partial<Search>, replace = false) => navigate({ to: "/app/search", search: { q, mode, only, ...patch }, replace });
  const submit = (text = input) => {
    const t = text.trim();
    if (!t) return;
    remember(t);
    set({ q: t, only: undefined });
  };

  return (
    <Screen title="Search">
      <SearchField id="app-q" value={input} onChange={(v) => { setInput(v); if (!v) set({ q: "", only: undefined }, true); }} onSubmit={() => submit()} placeholder="Scripture, classes, law…" autoFocus={!q} />
      <Segmented label="Search in" value={mode} onChange={(m) => set({ mode: m, only: undefined }, true)} options={[["library", "The library"], ["said", "What was taught"]]} />
      {!q ? (
        <>
          {recent.length ? (
            <Section title="Recent">
              <div className="app-list">
                {recent.map((r) => <Row key={r} onClick={() => { setInput(r); submit(r); }} title={r} trailing={<span className="app-row__chev"><Icon name="clock" size={16} /></span>} />)}
              </div>
            </Section>
          ) : null}
          <Section title="Try">
            <div className="app-chips">
              {EXAMPLES.map((e) => <button key={e} type="button" className="app-chip" onClick={() => { setInput(e); submit(e); }}>{e}</button>)}
            </div>
          </Section>
          <p className="app-hint">{mode === "said" ? "Searches the words spoken in every class and episode, and opens the recording at that moment." : "Searches every verse, class, study note, law and case. Put a phrase in quotes for an exact match."}</p>
        </>
      ) : mode === "said" ? <Said q={q} /> : <Library q={q} only={only} onOnly={(k) => set({ only: k })} />}
    </Screen>
  );
}

function Library({ q, only, onOnly }: { q: string; only?: string; onOnly: (k?: string) => void }) {
  const res = useQuery({
    queryKey: ["search", q, only ?? ""],
    queryFn: () => searchLibrary({ data: { q, only, limit: only ? 300 : 6 } }),
    staleTime: 5 * 60_000,
  });
  if (res.isPending) return <Skeleton rows={7} />;
  const r = res.data;
  if (!r || !r.ok) return <Empty title="Search is not answering right now">Try again in a moment.</Empty>;
  const total = Object.values(r.counts).reduce((a, b) => a + b, 0);
  if (!total && !r.hits.length) return <Empty title={`Nothing found for “${q}”`}>Try fewer words, or another spelling.</Empty>;
  const kinds = KIND_ORDER.filter((k) => r.counts[k] || r.hits.some((h) => h.kind === k));
  return (
    <>
      <div className="app-chips" role="group" aria-label="Filter by kind">
        <button type="button" className="app-chip" aria-pressed={!only} onClick={() => onOnly(undefined)}>All {total}</button>
        {kinds.map((k) => <button key={k} type="button" className="app-chip" aria-pressed={only === k} onClick={() => onOnly(only === k ? undefined : k)}>{KIND_LABEL[k] ?? k} {r.counts[k] ?? ""}</button>)}
      </div>
      {r.mode !== "strict" ? <p className="app-hint">Few exact matches, so results with any of the words are included.</p> : null}
      {(only ? [only] : kinds).map((k) => {
        const hits = r.hits.filter((h) => h.kind === k);
        if (!hits.length) return null;
        const more = (r.counts[k] ?? 0) - hits.length;
        return (
          <Section key={k} title={KIND_LABEL[k] ?? k}>
            <div className="app-list">
              {hits.map((h) => <Row key={h.url} href={h.url} meta={h.sub || undefined} title={h.title} sub={h.snippet} />)}
              {!only && more > 0 ? <button type="button" className="app-more-btn" onClick={() => onOnly(k)}>Show {more} more</button> : null}
            </div>
          </Section>
        );
      })}
    </>
  );
}

const FEED_LABEL: Record<string, string> = { classes: "Sabbath class", captains: "15 Min w/ Captains", history: "Our Hidden History" };

function Said({ q }: { q: string }) {
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [q]);
  const res = useQuery({
    queryKey: ["said", q, page],
    queryFn: () => searchTeachings({ data: { q, page } }),
    staleTime: 5 * 60_000,
  });
  if (res.isPending) return <Skeleton rows={6} />;
  const r = res.data;
  if (!r || r.unavailable) return <Empty title="The recordings search is not answering right now">Try again in a moment.</Empty>;
  if (!r.hits.length) return <Empty title={`No recording says “${q}”`}>Try fewer words. Captions can spell names differently.</Empty>;
  return (
    <>
      <div className="app-list">
        {r.hits.map((h, i) => (
          <Row
            key={`${h.video}-${h.start}-${i}`}
            onClick={() => openVideo(h.video, h.start)}
            thumb={`https://img.youtube.com/vi/${encodeURIComponent(h.video)}/mqdefault.jpg`}
            meta={[FEED_LABEL[h.feed] ?? "", when(h.date)].filter(Boolean).join(" · ")}
            title={<SearchHighlight text={h.matchedTitle || h.title} />}
            sub={<>▶ {timestamp(h.start)} · <SearchHighlight text={h.excerpt} /></>}
            trailing={<span />}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        {page > 0 ? <button type="button" className="app-chip" onClick={() => setPage(page - 1)}>Previous</button> : null}
        {r.more ? <button type="button" className="app-chip" onClick={() => setPage(page + 1)}>More results</button> : null}
      </div>
    </>
  );
}
