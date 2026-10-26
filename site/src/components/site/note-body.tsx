import { useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, type MouseEvent } from "react";

import { RefCards } from "@/components/site/ref-card";
import type { Book } from "@/lib/api";

/**
 * Rendered note HTML. Same-site links navigate through the router, and every scripture
 * reference gets a hover card with the verses, so a reader can check a citation without
 * leaving the note.
 */
export function NoteBody({ html, books }: { html: string; books?: Book[] }) {
  const router = useRouter();
  const body = useRef<HTMLDivElement>(null);
  const search = useRouterState({ select: (s) => s.location.searchStr });
  useEffect(() => {
    const value = new URLSearchParams(search).get("t");
    if (value !== null && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))) return;
    const frame = body.current?.querySelector<HTMLIFrameElement>('.note-video iframe');
    if (!frame) return;
    const url = new URL(frame.src);
    if (value === null) url.searchParams.delete("start");
    else url.searchParams.set("start", value);
    if (url.href !== frame.src) frame.src = url.href;
    if (value !== null) frame.scrollIntoView({ block: "center" });
  }, [html, search]);
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest("a");
    if (!a) return;
    const href = a.getAttribute("href") ?? "";
    if (!href.startsWith("/") || a.target || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    router.navigate({ href } as never);
  };
  return (
    <RefCards books={books}>
      <div ref={body} className="note" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
    </RefCards>
  );
}
