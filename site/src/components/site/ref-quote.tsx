import { Link } from "@tanstack/react-router";

import { GoLink, withFrom } from "@/components/site/return-bar";
import { fromHref } from "@/lib/cite";
import type { ResolvedRef } from "@/lib/api";

/**
 * One scripture reference as the law, precept and case pages print it: the reference as a
 * link into the chapter, the study note that teaches the chapter when there is one, and the
 * verses quoted in place from the KJV text the engine resolved at build time.
 */
export function RefQuote({ r, open = true }: { r: ResolvedRef; open?: boolean }) {
  const head = (
    <span className="refq__head">
      {r.url ? <Link to={r.url as never} className="refq__ref" data-verses={r.verses || undefined}>{r.label}</Link> : <span className="refq__ref">{r.label}</span>}
      {r.key ? <span className="refq__key">key</span> : null}
    </span>
  );
  if (!r.text.length) return <div className="refq">{head}</div>;
  return (
    <details className="refq" open={open}>
      <summary>{head}</summary>
      <blockquote>
        {r.text.map((v) => <p key={v.verse}><sup>{v.verse}</sup>{v.text}</p>)}
        {r.more > 0 && r.url ? <p className="refq__more"><Link to={r.url as never}>{r.more} more {r.more === 1 ? "verse" : "verses"} in the chapter</Link></p> : null}
      </blockquote>
    </details>
  );
}

/** The compact form: `Exod 20:13 · Deut 5:17`, each a link. */
export function RefRow({ refs }: { refs: ResolvedRef[] }) {
  return (
    <p className="refrow">
      {refs.map((r, i) => (
        <span key={i}>
          {i ? <span className="refrow__dot"> · </span> : null}
          {r.url ? <Link to={r.url as never} data-verses={r.verses || undefined}>{r.label}</Link> : r.label}
        </span>
      ))}
    </p>
  );
}

/**
 * The footnote: where these passages were taught in the daily reading. Each link lands on
 * the line of the study note that cites the passage and carries a Return to this page.
 */
export function TaughtIn({ refs }: { refs: ResolvedRef[] }) {
  const rows = new Map<string, { range: string; url: string; refs: ResolvedRef[] }>();
  for (const r of refs) {
    if (!r.study || !r.slug) continue;
    const row = rows.get(r.study.url) ?? { ...r.study, refs: [] };
    row.refs.push(r);
    rows.set(r.study.url, row);
  }
  if (!rows.size) return null;
  return (
    <aside className="taughtin" aria-label="Taught in">
      <p className="cj-kicker">Taught in</p>
      <ol>
        {[...rows.values()].map((row) => (
          <li key={row.url}>
            <span className="taughtin__note">{row.range}</span>
            <span className="taughtin__refs">
              {row.refs.map((r, i) => (
                <span key={i}>{i ? " · " : ""}<GoLink href={withFrom(row.url, fromHref(r.slug!, r.chapter, r.verses ?? ""))}>{r.label}</GoLink></span>
              ))}
            </span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
