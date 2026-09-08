import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Tabs } from "radix-ui";

import { api, dataOrigin, type Book, type Case, type Citation, type LawEntry, type LawSection, type Note } from "@/lib/api";
import { compressVerses, findCiteLink, fromHref, landOn, type From } from "@/lib/cite";
import { GoLink, withFrom } from "@/components/site/return-bar";
import { renderNote } from "@/lib/markdown";
import { citationsForVerses, parseRef, shelf, type Ref } from "@/lib/refs";
import { RefCards } from "@/components/site/ref-card";

/**
 * The study panel beside the text, the Logos habit: everything that cites this chapter, read
 * in place. Pick a verse to narrow the list; open a note, law, precept or case and it renders
 * inside the panel while the chapter stays put. Scripture links inside the panel show hover
 * cards, and Open in a card moves the reader to that chapter with the panel still open.
 */
type Precept = { title: string; slug: string; refs: { book: string; chapter: number; verses?: string; key?: boolean }[] };
type Doc =
  | { kind: "note"; note: Note; html: string }
  | { kind: "case"; c: Case }
  | { kind: "precept"; p: Precept }
  | { kind: "law"; label: string; url: string; section: LawSection; entry: LawEntry | null }
  | { kind: "error"; url: string };

const docCache = new Map<string, Promise<Doc>>();

function loadDoc(c: Citation): Promise<Doc> {
  let p = docCache.get(c.url);
  if (p) return p;
  const s = shelf(c);
  const run = async (): Promise<Doc> => {
    try {
      if (s === "study" || s === "class" || s === "captains" || s === "history" || s === "encyclopedia") {
        const note = await api.note(c.url);
        return { kind: "note", note, html: renderNote(note.body) };
      }
      if (s === "case") {
        const slug = c.url.split("/").filter(Boolean).pop() ?? "";
        return { kind: "case", c: await api.case(slug) };
      }
      if (s === "precept") {
        const slug = c.url.split("/").filter(Boolean).pop() ?? "";
        const res = await fetch(`${await dataOrigin()}/api/precepts/${slug}.json`);
        if (!res.ok) throw new Error(String(res.status));
        return { kind: "precept", p: (await res.json()) as Precept };
      }
      const [pathPart, hash] = c.url.split("#");
      const sectionId = pathPart.split("/").filter(Boolean).pop() ?? "";
      const section = await api.law(sectionId);
      const entry = section.entries.find((e) => e.id === hash) ?? null;
      return { kind: "law", label: c.label, url: c.url, section, entry };
    } catch {
      return { kind: "error", url: c.url };
    }
  };
  p = run();
  docCache.set(c.url, p);
  return p;
}

const GROUPS: { id: string; label: string; shelves: ReturnType<typeof shelf>[] }[] = [
  { id: "notes", label: "Notes", shelves: ["study", "class", "captains", "history", "encyclopedia", "other"] },
  { id: "law", label: "Law", shelves: ["law"] },
  { id: "precepts", label: "Precepts", shelves: ["precept"] },
  { id: "cases", label: "Cases", shelves: ["case"] },
];
const SHELF_LABEL: Record<string, string> = { study: "4 Chapters a Day", class: "Sabbath class", captains: "15 Min w/Captains", history: "Our Hidden History", encyclopedia: "Encyclopedia", law: "Law", precept: "Precept", case: "Case", other: "Note" };

const VERDICT: Record<string, string> = { death: "Put to death", plague: "Plague", exile: "Exile", captivity: "Captivity", curse: "Cursed", restitution: "Restitution", spared: "Spared", reprieve: "Reprieve", temporal: "Temporal judgment", unrecorded: "Sentence not recorded", blessed: "Kept the law" };


export function StudyPanel({
  books, citations, origin, activeVerses, study, onStudy, onVerses, onGo, compact = false,
}: {
  books: Book[];
  citations: Citation[];
  origin: { slug: string; chapter: number };
  activeVerses: number[];
  study?: string;
  onStudy: (url: string | undefined) => void;
  onVerses: (v: number[]) => void;
  onGo: (ref: Ref) => void;
  compact?: boolean;
}) {
  const [tab, setTab] = useState("all");
  const from: From = { slug: origin.slug, chapter: origin.chapter, verses: activeVerses, href: fromHref(origin.slug, origin.chapter, activeVerses) };

  const visible = useMemo(() => (activeVerses.length ? citationsForVerses(citations, activeVerses) : citations), [citations, activeVerses]);
  const counts = useMemo(() => {
    const m: Record<string, number> = { all: visible.length };
    for (const g of GROUPS) m[g.id] = visible.filter((c) => g.shelves.includes(shelf(c))).length;
    return m;
  }, [visible]);
  const shown = tab === "all" ? visible : visible.filter((c) => GROUPS.find((g) => g.id === tab)?.shelves.includes(shelf(c)));
  const open = study ? citations.find((c) => c.url === study) ?? { kind: "note", label: study, url: study, verses: "" } : null;

  useEffect(() => { if (counts[tab] === 0) setTab("all"); }, [counts, tab]);

  return (
    <div className={compact ? "study study--compact" : "study"}>
      {open ? (
        <DocView c={open} books={books} from={from} onBack={() => onStudy(undefined)} onGo={onGo} onStudy={onStudy} />
      ) : (
        <>
          <div className="study__head">
            <h2>Cited by</h2>
            {activeVerses.length ? (
              <button type="button" className="chip chip--active" onClick={() => onVerses([])} aria-label={`Showing ${activeVerses.length === 1 ? "verse" : "verses"} ${compressVerses(activeVerses)}; clear`}>
                {activeVerses.length === 1 ? "Verse" : "Verses"} {compressVerses(activeVerses).replace(/,/g, ", ")} <span aria-hidden="true">×</span>
              </button>
            ) : (
              <span className="cj-mono">{citations.length ? "Whole chapter" : ""}</span>
            )}
          </div>
          {citations.length === 0 ? (
            <p className="study__empty">Nothing in the library cites this chapter yet.</p>
          ) : (
            <Tabs.Root value={tab} onValueChange={setTab} className="study__tabs">
              <Tabs.List className="tablist" aria-label="Kinds">
                <Tabs.Trigger value="all" className="tab">All <b>{counts.all}</b></Tabs.Trigger>
                {GROUPS.filter((g) => counts[g.id] > 0).map((g) => (
                  <Tabs.Trigger key={g.id} value={g.id} className="tab">{g.label} <b>{counts[g.id]}</b></Tabs.Trigger>
                ))}
              </Tabs.List>
              <div className="study__list">
                {shown.length === 0 ? (
                  <p className="study__empty">Nothing cites {activeVerses.length === 1 ? "verse" : "verses"} {compressVerses(activeVerses).replace(/,/g, ", ")} in this shelf.</p>
                ) : (
                  <ul className="cited">
                    {shown.map((c) => (
                      <li key={c.url}>
                        <button type="button" className="cited__item" onClick={() => onStudy(c.url)}>
                          <small>{SHELF_LABEL[shelf(c)]}{c.verses ? ` · vv. ${c.verses}` : ""}</small>
                          <span>{c.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Tabs.Root>
          )}
        </>
      )}
    </div>
  );
}

const PANEL_KINDS = ["/study/", "/classes/", "/captains/", "/history/", "/cases/", "/encyclopedia/", "/precepts/"];

function DocView({ c, books, from, onBack, onGo, onStudy }: { c: Citation; books: Book[]; from: From; onBack: () => void; onGo: (ref: Ref) => void; onStudy: (url: string) => void }) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const url = c.url;
  useEffect(() => {
    let alive = true;
    setDoc(null);
    loadDoc(c).then((d) => { if (alive) setDoc(d); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
  // Once the document is in, land on the line that cites the verses the reader has selected.
  useEffect(() => {
    if (!doc || doc.kind === "error" || !body.current) return;
    const root = body.current;
    const t = window.setTimeout(() => { const el = findCiteLink(root, from); if (el) landOn(el, root.closest(".reader__sticky, .sheet") as HTMLElement | null ?? root); }, 60);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, from.href]);
  useEffect(() => { body.current?.scrollTo({ top: 0 }); }, [doc]);

  // Links inside an opened document stay inside the reader: scripture moves the text, other
  // library documents open in this panel, everything else is a normal link.
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest("a");
    if (!a || a.target || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const href = a.getAttribute("href") ?? "";
    const ref = parseRef(href);
    if (ref) { e.preventDefault(); onGo(ref); return; }
    const local = href;
    if (PANEL_KINDS.some((k) => local.startsWith(k))) { e.preventDefault(); onStudy(local.split("#")[0]); }
  };

  const s = shelf(c);
  return (
    <div className="doc" onClick={onClick}>
      <div className="doc__bar">
        <button type="button" className="doc__back" onClick={onBack}>← Cited by</button>
        <GoLink className="read-link" href={withFrom(c.url, from.href)}>
          <span>Open page</span><span aria-hidden="true">→</span>
        </GoLink>
      </div>
      <div className="doc__body" ref={body}>
        <p className="cj-kicker">{SHELF_LABEL[s]}{c.verses ? ` · vv. ${c.verses}` : ""}</p>
        {doc === null ? (
          <p className="cj-mono">Loading</p>
        ) : doc.kind === "error" ? (
          <p className="cj-mono">This one could not be loaded here. Use Open page.</p>
        ) : doc.kind === "note" ? (
          <RefCards books={books} onOpen={onGo}>
            <h3 className="doc__title">{doc.note.title}</h3>
            {doc.note.teacher || doc.note.date ? <p className="cj-mono">{[doc.note.teacher, doc.note.date].filter(Boolean).join(" · ")}</p> : null}
            <div className="note note--panel" dangerouslySetInnerHTML={{ __html: doc.html }} />
          </RefCards>
        ) : doc.kind === "case" ? (
          <RefCards books={books} onOpen={onGo}>
            <h3 className="doc__title">{doc.c.name}</h3>
            <p className="cj-mono">{doc.c.era} · {VERDICT[doc.c.verdict] ?? doc.c.verdict}</p>
            <div className="note note--panel">
              <p><strong>Charge.</strong> {doc.c.charge}</p>
              {doc.c.summary ? <p>{doc.c.summary}</p> : null}
              {doc.c.offense ? <p><strong>Offense.</strong> {doc.c.offense}</p> : null}
              {doc.c.judgment ? <p><strong>{doc.c.kind === "blessing" ? "Blessing." : "Judgment."}</strong> {doc.c.judgment}</p> : null}
              {doc.c.laws.length > 0 && <section aria-label={doc.c.kind === "blessing" ? "Laws kept" : "Laws broken"}>
                <h4>{doc.c.kind === "blessing" ? "Laws kept" : "Laws broken"}</h4>
                <ul>{(doc.c.lawsResolved ?? doc.c.laws.map(id => ({ id, text: "", url: null }))).map(law => <li key={law.id}>{law.url ? <a href={law.url}>{law.id}{law.text ? ` · ${law.text}` : ""}</a> : law.id}</li>)}</ul>
              </section>}
              {doc.c.refs.length ? (
                <p>
                  <strong>Scripture.</strong>{" "}
                  {doc.c.refs.map((r, i) => {
                    const b = books.find((x) => x.book === r.book);
                    const href = b ? `/bible/${b.slug}/${r.chapter}${r.verses ? `#v${r.verses.split("-")[0]}` : ""}` : "";
                    return <span key={i}>{i ? ", " : ""}{href ? <a href={href}>{r.book} {r.chapter}{r.verses ? `:${r.verses}` : ""}</a> : `${r.book} ${r.chapter}`}</span>;
                  })}
                </p>
              ) : null}
            </div>
          </RefCards>
        ) : doc.kind === "precept" ? (
          <RefCards books={books} onOpen={onGo}>
            <h3 className="doc__title">{doc.p.title}</h3>
            <p className="cj-mono">{doc.p.refs.length} references</p>
            <ul className="preceptrefs">
              {doc.p.refs.map((r, i) => {
                const b = books.find((x) => x.book === r.book);
                const href = b ? `/bible/${b.slug}/${r.chapter}${r.verses ? `#v${r.verses.split("-")[0]}` : ""}` : "";
                const label = `${r.book} ${r.chapter}${r.verses ? `:${r.verses}` : ""}`;
                return <li key={i} className={r.key ? "is-key" : undefined}>{href ? <a href={href}>{label}</a> : label}</li>;
              })}
            </ul>
          </RefCards>
        ) : (
          <RefCards books={books} onOpen={onGo}>
            <h3 className="doc__title">{doc.entry ? doc.entry.id : doc.section.id} · {doc.section.title}</h3>
            <p className="cj-mono">Part {doc.section.part.n}: {doc.section.part.title}</p>
            <div className="note note--panel">
              {doc.entry ? (
                <>
                  <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.05rem" }}>{doc.entry.text}</p>
                  <p><strong>Scripture.</strong> {doc.entry.refs.map((r, i) => <span key={i}>{i ? ", " : ""}{r.url ? <a href={r.url} data-verses={r.verses || undefined}>{r.label}</a> : r.label}</span>)}</p>
                </>
              ) : (
                <ul>{doc.section.entries.slice(0, 12).map((e) => <li key={e.id}><span className="cj-mono">{e.id}</span> {e.text}</li>)}</ul>
              )}
            </div>
          </RefCards>
        )}
      </div>
    </div>
  );
}
