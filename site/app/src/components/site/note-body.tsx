import { useRouter } from "@tanstack/react-router";
import type { MouseEvent } from "react";

/** Rendered note HTML; same-site links inside it navigate through the router. */
export function NoteBody({ html }: { html: string }) {
  const router = useRouter();
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest("a");
    if (!a) return;
    const href = a.getAttribute("href") ?? "";
    if (!href.startsWith("/") || a.target || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    router.navigate({ href } as never);
  };
  return <div className="note" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />;
}
