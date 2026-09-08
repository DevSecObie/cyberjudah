import { useEffect, useRef, useState, type ReactNode } from "react";

import type { TableOfContentElement, TableOfContentItem } from "@/components/ui/table-of-content";

/**
 * A long note with a contents rail beside it (the 21st.dev Table of Content element): the
 * rail's ticks are the note's headings, the tick for the section being read is lit, resting
 * on the rail previews a section, and a click or a keyboard commit scrolls to it. Below
 * 1100px the rail is left out and the note reads as it did.
 */
const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

export function NoteWithContents({ children, minHeadings = 4, label = "Contents" }: { children: ReactNode; minHeadings?: number; label?: string }) {
  const body = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<{ el: HTMLElement; item: TableOfContentItem }[]>([]);

  // Headings become items once the note is in the DOM; ids are stamped for deep links.
  useEffect(() => {
    const root = body.current;
    if (!root) return;
    const heads = Array.from(root.querySelectorAll<HTMLElement>("h2, h3"));
    const seen = new Set<string>();
    const out = heads.map((el) => {
      let id = el.id || slug(el.textContent ?? "") || "section";
      while (seen.has(id)) id += "-";
      seen.add(id);
      el.id = id;
      let p = el.nextElementSibling;
      while (p && !/^(P|UL|OL|BLOCKQUOTE)$/.test(p.tagName)) p = p.nextElementSibling;
      const description = (p?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
      return { el, item: { id, title: (el.textContent ?? "").trim(), description } };
    });
    setItems(out.length >= minHeadings ? out : []);
  }, [children, minHeadings]);

  useEffect(() => {
    const host = rail.current;
    if (!host || !items.length) return;
    let el: TableOfContentElement | null = null;
    let cancelled = false;
    let onCommit: ((e: Event) => void) | null = null;
    let onScroll: (() => void) | null = null;
    (async () => {
      const mod = await import("@/components/ui/table-of-content");
      mod.defineTableOfContent();
      if (cancelled) return;
      el = document.createElement("table-of-content") as TableOfContentElement;
      el.label = label;
      el.items = items.map((i) => i.item);
      host.replaceChildren(el);
      onCommit = (e: Event) => {
        const idx = (e as CustomEvent<{ index: number }>).detail.index;
        const target = items[idx]?.el;
        if (target) { target.scrollIntoView({ block: "start", behavior: "smooth" }); history.replaceState(null, "", `#${target.id}`); }
      };
      el.addEventListener("toc-commit", onCommit);
      // Scroll spy: the last heading above the top third of the viewport is the current one.
      let raf = 0;
      onScroll = () => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const line = window.innerHeight * 0.33;
          let cur = 0;
          for (let i = 0; i < items.length; i++) if (items[i].el.getBoundingClientRect().top <= line) cur = i;
          if (el && (el as TableOfContentElement & { current: number }).current !== cur) {
            (el as TableOfContentElement & { current: number }).current = cur;
            if (!el.hasAttribute("data-open")) el.select(cur, { open: false, emit: false });
          }
        });
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    })();
    return () => {
      cancelled = true;
      if (el && onCommit) el.removeEventListener("toc-commit", onCommit);
      if (onScroll) window.removeEventListener("onscroll" as never, onScroll);
      if (onScroll) window.removeEventListener("scroll", onScroll);
      host.replaceChildren();
    };
  }, [items, label]);

  return (
    <div className={items.length ? "note-layout note-layout--rail" : "note-layout"}>
      <div ref={body} className="note-layout__body">{children}</div>
      {items.length ? <aside className="note-layout__rail" aria-label={label}><div ref={rail} /></aside> : null}
    </div>
  );
}
