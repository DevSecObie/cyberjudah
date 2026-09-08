import { Link } from "@tanstack/react-router";

import type { ResolvedRef } from "@/lib/api";

/**
 * One scripture reference as the law, precept and case pages print it: the reference as a
 * link into the chapter and the verses quoted in place from the KJV text the engine resolved at build time.
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

