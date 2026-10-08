import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useMemo, useState } from "react";

import { Empty, Row, Screen, SearchField, Segmented, Skeleton, when } from "@/components/app/ui";
import { api, thumbUrl } from "@/lib/api";

type Feed = "classes" | "captains" | "history" | "truth";
const FEEDS: [Feed, string][] = [["classes", "Sabbath"], ["captains", "Captains"], ["history", "History"], ["truth", "Truth"]];
const TRUTH = "The Truth Shall Make You Free";
const PAGE = 40;

export const Route = createFileRoute("/app/classes")({
  validateSearch: (s: Record<string, unknown>): { feed: Feed } => ({ feed: FEEDS.some(([f]) => f === s.feed) ? (s.feed as Feed) : "classes" }),
  component: Classes,
});

type Item = { url: string; title: string; date: string; teacher: string; thumb: string; topics: string[]; books: string[] };

function useFeed(feed: Feed) {
  return useQuery({
    queryKey: ["feed", feed],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Item[]> => {
      if (feed === "history") {
        const rows = await api.history();
        return rows.map((r) => ({ url: r.url, title: r.title, date: r.date ?? "", teacher: r.teacher, thumb: r.thumb ? thumbUrl(r.thumb) : "", topics: r.topics, books: [] }));
      }
      const rows = feed === "captains" ? await api.captains() : await api.classes();
      return rows
        .filter((r) => (feed === "truth" ? r.collection === TRUTH : feed === "classes" ? r.collection !== TRUTH : true))
        .map((r) => ({ url: r.url, title: r.title, date: r.date, teacher: r.teacher, thumb: r.thumb, topics: r.topics ?? [], books: r.books }));
    },
  });
}

function Classes() {
  const { feed } = Route.useSearch();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);
  const query = useDeferredValue(q.trim().toLowerCase());
  const data = useFeed(feed);
  const rows = useMemo(() => {
    const all = [...(data.data ?? [])].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    if (!query) return all;
    return all.filter((r) => `${r.title} ${r.teacher} ${r.topics.join(" ")} ${r.books.join(" ")}`.toLowerCase().includes(query));
  }, [data.data, query]);

  return (
    <Screen title="Classes" kicker="Watch · read · listen">
      <Segmented label="Series" value={feed} onChange={(f) => { setShown(PAGE); navigate({ to: "/app/classes", search: { feed: f }, replace: true }); }} options={FEEDS} />
      <SearchField id="app-class-q" value={q} onChange={(v) => { setQ(v); setShown(PAGE); }} placeholder="Filter by title, topic, book or teacher" />
      {data.isPending ? <Skeleton rows={8} thumb /> : data.isError ? <Empty title="The classes did not load">Check your connection and try again.</Empty> : !rows.length ? (
        <Empty title="No class matches that">Try a topic like “Passover”, or a book like “Isaiah”.</Empty>
      ) : (
        <div className="app-list">
          {rows.slice(0, shown).map((r) => <Row key={r.url} href={r.url} thumb={r.thumb} meta={when(r.date, r.teacher)} title={r.title} />)}
          {rows.length > shown ? <button type="button" className="app-more-btn" onClick={() => setShown(shown + PAGE)}>Show more ({rows.length - shown} left)</button> : null}
        </div>
      )}
    </Screen>
  );
}
