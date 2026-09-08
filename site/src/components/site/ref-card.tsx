import { useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

import type { Book, Verse } from "@/lib/api";
import { getChapter, parseRef, refPath, refTitle, verseNumbers, type Ref } from "@/lib/refs";

/**
 * Scripture hover cards, the e-Sword habit: rest the pointer on any /bible/... link inside
 * this wrapper and the verses appear in a card beside it; the page underneath never moves.
 * One delegated listener per wrapper, so it works on rendered markdown too. Touch devices get
 * the same card on tap, with an explicit Open action.
 */
type Open = { href: string; ref: Ref; spec?: string; anchor: DOMRect; verses: Verse[] | null; more?: number; error?: boolean };

const MAX_VERSES = 12;

export function RefCards({ children, books, className, onOpen }: { children: ReactNode; books?: Book[]; className?: string; onOpen?: (ref: Ref) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const [mounted, setMounted] = useState(false);
  const timers = useRef<{ show?: number; hide?: number }>({});
  const router = useRouter();

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async (a: HTMLAnchorElement, ref: Ref) => {
    const rect = a.getBoundingClientRect();
    // A link may name a verse list the anchor cannot (Hebrews 7:19,25): data-verses carries it.
    const spec = a.dataset.verses || undefined;
    setOpen({ href: a.getAttribute("href") ?? "", ref, spec, anchor: rect, verses: null });
    try {
      const ch = await getChapter(ref.slug, ref.chapter);
      let wanted: number[];
      if (spec) wanted = verseNumbers(spec);
      else {
        const from = ref.verse ?? 1;
        const to = ref.verseEnd && ref.verseEnd >= from ? ref.verseEnd : ref.verse ? from : Math.min(ch.verses.length, 3);
        wanted = Array.from({ length: to - from + 1 }, (_, i) => from + i);
      }
      const all = ch.verses.filter((v) => wanted.includes(v.verse));
      const verses = all.slice(0, MAX_VERSES);
      setOpen((o) => (o && o.href === (a.getAttribute("href") ?? "") ? { ...o, verses, more: all.length - verses.length } : o));
    } catch {
      setOpen((o) => (o ? { ...o, verses: [], error: true } : o));
    }
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const findRef = (t: EventTarget | null) => {
      const a = (t as HTMLElement | null)?.closest?.("a") as HTMLAnchorElement | null;
      if (!a || !el.contains(a)) return null;
      const ref = parseRef(a.getAttribute("href") ?? "");
      return ref ? { a, ref } : null;
    };
    const clear = () => { window.clearTimeout(timers.current.show); window.clearTimeout(timers.current.hide); };

    const onOver = (e: MouseEvent) => {
      if (coarse) return;
      const hit = findRef(e.target);
      if (!hit) return;
      clear();
      timers.current.show = window.setTimeout(() => load(hit.a, hit.ref), 140);
    };
    const onOut = (e: MouseEvent) => {
      if (coarse) return;
      const hit = findRef(e.target);
      if (!hit) return;
      const to = e.relatedTarget as Node | null;
      if (to && card.current?.contains(to)) return;
      clear();
      timers.current.hide = window.setTimeout(() => setOpen(null), 220);
    };
    const onClick = (e: MouseEvent) => {
      if (!coarse) return;
      const hit = findRef(e.target);
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      clear();
      load(hit.a, hit.ref);
    };
    const onFocus = (e: FocusEvent) => {
      const hit = findRef(e.target);
      if (hit) { clear(); load(hit.a, hit.ref); }
    };
    const onBlur = (e: FocusEvent) => {
      if (findRef(e.target)) { clear(); timers.current.hide = window.setTimeout(() => setOpen(null), 220); }
    };
    el.addEventListener("mouseover", onOver);
    el.addEventListener("mouseout", onOut);
    el.addEventListener("click", onClick, true);
    el.addEventListener("focusin", onFocus);
    el.addEventListener("focusout", onBlur);
    return () => {
      clear();
      el.removeEventListener("mouseover", onOver);
      el.removeEventListener("mouseout", onOut);
      el.removeEventListener("click", onClick, true);
      el.removeEventListener("focusin", onFocus);
      el.removeEventListener("focusout", onBlur);
    };
  }, [load]);

  // Close on escape, on scroll (the anchor moved), and on outside taps.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    const onScroll = () => setOpen(null);
    const onDown = (e: PointerEvent) => { if (card.current && !card.current.contains(e.target as Node)) setOpen(null); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [open]);

  const go = () => {
    if (!open) return;
    setOpen(null);
    if (onOpen) onOpen(open.ref);
    else router.navigate({ href: refPath(open.ref) } as never);
  };

  const style = open ? place(open.anchor) : undefined;

  return (
    <div ref={wrap} className={className}>
      {children}
      {mounted && open
        ? createPortal(
            <div
              ref={card}
              className="refcard"
              style={style}
              role="dialog"
              aria-label={cardTitle(open, books)}
              onMouseEnter={() => window.clearTimeout(timers.current.hide)}
              onMouseLeave={() => { timers.current.hide = window.setTimeout(() => setOpen(null), 180); }}
            >
              <div className="refcard__head">
                <span className="refcard__title">{cardTitle(open, books)}</span>
                <button type="button" className="refcard__open" onClick={go}>Open</button>
              </div>
              <div className="refcard__body">
                {open.verses === null ? (
                  <span className="cj-mono">Reading</span>
                ) : open.error ? (
                  <span className="cj-mono">Could not reach the text.</span>
                ) : (
                  open.verses.map((v) => (
                    <p key={v.verse}><sup>{v.verse}</sup>{v.text}</p>
                  ))
                )}
                {open.more ? <p className="cj-mono refcard__more">{open.more} more in the chapter</p> : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function cardTitle(o: Open, books?: Book[]): string {
  if (!o.spec) return refTitle(o.ref, books);
  return `${refTitle({ slug: o.ref.slug, chapter: o.ref.chapter }, books)}:${o.spec}`;
}

/** Fixed-position placement beside the anchor, flipped above when the bottom is short. */
function place(r: DOMRect): CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(380, vw - 24);
  const est = 260;
  let left = Math.max(12, Math.min(r.left, vw - w - 12));
  let top = r.bottom + 8;
  let maxHeight = vh - top - 12;
  if (maxHeight < 160 && r.top > vh - r.bottom) {
    maxHeight = r.top - 20;
    top = Math.max(12, r.top - 8 - Math.min(est, maxHeight));
  }
  if (vw < 640) { left = 12; }
  return { position: "fixed", left, top, width: w, maxHeight: Math.max(120, maxHeight) };
}
