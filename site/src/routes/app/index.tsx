import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Icon, Img, Screen, Section, Skeleton, useGo, when } from "@/components/app/ui";
import { api, fmtDate, thumbUrl } from "@/lib/api";
import { PASSAGES, passageOfTheDay } from "@/lib/passages";
import { prefs, tg } from "@/lib/telegram";

export const Route = createFileRoute("/app/")({ component: Home });

type Last = { slug: string; chapter: number; name: string };

function useLastRead() {
  const [last, setLast] = useState<Last | null>(null);
  useEffect(() => {
    prefs.get("last-read", (v) => {
      try {
        const p = v ? JSON.parse(v) : null;
        if (p && typeof p.slug === "string" && Number.isInteger(p.chapter) && typeof p.name === "string") setLast(p);
      } catch { /* ignore */ }
    });
  }, []);
  return last;
}

function latest<T extends { date: string }>(rows?: T[]): T[] {
  return [...(rows ?? [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
}

const SHORTCUTS: { to: string; label: string; tag: string }[] = [
  { to: "/app/classes?feed=classes", label: "Sabbath Classes", tag: "watch" },
  { to: "/app/classes?feed=captains", label: "15 Min w/ Captains", tag: "watch" },
  { to: "/app/classes?feed=history", label: "Our Hidden History", tag: "listen" },
  { to: "/law", label: "The Law", tag: "handbook" },
  { to: "/precepts", label: "Precepts", tag: "a–z" },
  { to: "/study", label: "4 Chapters a Day", tag: "daily" },
];

function Home() {
  const go = useGo();
  const last = useLastRead();
  const [passage, setPassage] = useState(PASSAGES[0]);
  const [name, setName] = useState("");
  useEffect(() => {
    setPassage(passageOfTheDay());
    setName(tg()?.initDataUnsafe.user?.first_name ?? "");
  }, []);
  const classes = useQuery({ queryKey: ["classes"], queryFn: api.classes, staleTime: 5 * 60_000 });
  const captains = useQuery({ queryKey: ["captains"], queryFn: api.captains, staleTime: 5 * 60_000 });

  return (
    <Screen>
      <div className="app-hello">
        <img src="/assets/brand/cyber-lion.png" alt="" width={44} height={44} />
        <div>
          <p>{name ? `Shalom, ${name}` : "Shalom"}</p>
          <h1>CyberJudah</h1>
        </div>
      </div>

      <button type="button" className="app-field app-field--button" onClick={() => go("/app/search")}>
        <Icon name="search" size={18} />
        <span>Search scripture, classes, law…</span>
      </button>

      {last ? (
        <Link to="/app/read/$book/$chapter" params={{ book: last.slug, chapter: String(last.chapter) }} className="app-card app-continue">
          <span className="app-continue__icon"><Icon name="book" /></span>
          <span><b>Continue reading</b><span>{last.name}</span></span>
        </Link>
      ) : null}

      <a className="app-card app-card--glow" href={passage.to} onClick={(e) => { e.preventDefault(); go(passage.to); }}>
        <p className="app-card__label">Today's passage</p>
        <p className="app-verse"><b>{passage.lead}</b>{passage.rest}</p>
        <p className="app-card__ref">{passage.ref}</p>
      </a>

      <Section title="Latest classes" action={<Link to="/app/classes" search={{ feed: "classes" } as never}>See all</Link>}>
        {classes.isPending ? <Skeleton rows={2} thumb /> : (
          <div className="app-rail">
            {latest(classes.data).map((c) => (
              <a key={c.url} className="app-tile" href={c.url} onClick={(e) => { e.preventDefault(); go(c.url); }}>
                <span className="app-tile__img">{c.thumb ? <Img src={thumbUrl(c.thumb)} /> : null}</span>
                <b>{c.title}</b>
                <span>{when(c.date, c.teacher)}</span>
              </a>
            ))}
          </div>
        )}
      </Section>

      <Section title="Explore">
        <div className="app-grid">
          {SHORTCUTS.map((s) => (
            <a key={s.to} href={s.to} onClick={(e) => { e.preventDefault(); go(s.to); }}><b>{s.label}</b><span>{s.tag}</span></a>
          ))}
        </div>
      </Section>

      <Section title="15 Minutes w/ The Captains" action={<Link to="/app/classes" search={{ feed: "captains" } as never}>See all</Link>}>
        {captains.isPending ? <Skeleton rows={2} thumb /> : (
          <div className="app-rail">
            {latest(captains.data).map((c) => (
              <a key={c.url} className="app-tile" href={c.url} onClick={(e) => { e.preventDefault(); go(c.url); }}>
                <span className="app-tile__img">{c.thumb ? <Img src={thumbUrl(c.thumb)} /> : null}</span>
                <b>{c.title}</b>
                <span>{c.date ? fmtDate(c.date) : ""}</span>
              </a>
            ))}
          </div>
        )}
      </Section>
    </Screen>
  );
}
