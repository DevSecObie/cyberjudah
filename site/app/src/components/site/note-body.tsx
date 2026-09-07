import { useRouter } from "@tanstack/react-router";
import type { MouseEvent } from "react";

import { RefCards } from "@/components/site/ref-card";
import type { Book } from "@/lib/api";

/**
 * Rendered note HTML. Same-site links navigate through the router, and every scripture
 * reference gets a hover card with the verses, so a reader can check a citation without
 * leaving the note.
 */
export function NoteBody({ html, books }: { html: string; books?: Book[] }) {
  const router = useRouter();
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
      <div className="note" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
    </RefCards>
  );
}
