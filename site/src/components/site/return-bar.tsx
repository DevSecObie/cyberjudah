import { Link, useRouter, useSearch } from "@tanstack/react-router";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

import { findCiteLink, landOn, parseFrom, type From } from "@/lib/cite";
import { bookName, type Book } from "@/lib/api";

/**
 * Wrap a page's body in this and it becomes a landing page for citations: when the URL
 * carries `?from=/bible/<book>/<chapter>?v=<verses>`, the page scrolls to the line that
 * cites those verses and shows a Return bar back to the reader, with the verses selected.
 */
export function CiteLanding({ children, books }: { children: ReactNode; books?: Book[] }) {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const from = parseFrom(search.from);
  const [wrap, setWrap] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!from || !wrap) return;
    // The note renders in the same commit; give fonts and images a beat before measuring.
    const t = window.setTimeout(() => { const el = findCiteLink(wrap, from); if (el) landOn(el); }, 120);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from?.href, wrap]);
  return (
    <div ref={setWrap}>
      {from ? <ReturnBar from={from} books={books} /> : null}
      {children}
    </div>
  );
}

export function ReturnBar({ from, books }: { from: From; books?: Book[] }) {
  const label = `${bookName(from.slug, books)} ${from.chapter}${from.verses.length ? `:${verseLabel(from.verses)}` : ""}`;
  return (
    <div className="returnbar" role="navigation" aria-label="Return to the reader">
      <Link to="/bible/$book/$chapter" params={{ book: from.slug, chapter: String(from.chapter) }} search={{ v: from.verses.length ? specOf(from.verses) : undefined, study: undefined } as never} hash={from.verses.length ? `v${from.verses[0]}` : undefined} className="returnbar__link">
        <span aria-hidden="true">←</span> Return to {label}
      </Link>
    </div>
  );
}

function specOf(nums: number[]): string {
  const s = [...new Set(nums)].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) { let j = i; while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++; out.push(j > i ? `${s[i]}-${s[j]}` : String(s[i])); i = j; }
  return out.join(",");
}
function verseLabel(nums: number[]): string { return specOf(nums).replace(/,/g, ", "); }

/** A link that carries the reader's origin: same-site navigation through the router. */
export function GoLink({ href, className, children, title }: { href: string; className?: string; children: ReactNode; title?: string }) {
  const router = useRouter();
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    router.navigate({ href } as never);
  };
  return <a href={href} className={className} title={title} onClick={onClick}>{children}</a>;
}

export function withFrom(url: string, from?: string | null): string {
  if (!from) return url;
  const [path, hash] = url.split("#");
  return `${path}${path.includes("?") ? "&" : "?"}from=${encodeURIComponent(from)}${hash ? `#${hash}` : ""}`;
}
