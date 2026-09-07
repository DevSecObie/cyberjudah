import { useNavigate } from "@tanstack/react-router";
import { Command } from "cmdk";
import { useEffect, useState } from "react";

import { api, type Book } from "@/lib/api";

/**
 * The command menu (cmdk, the shadcn/21st "Command" primitive): press Cmd K or Ctrl K anywhere,
 * or the slash key outside a field. Type a word to search the library, or a book name to jump
 * to it; a reference like "psalms 23" goes straight to the chapter.
 */
const SECTIONS = [
  { label: "The Bible", to: "/bible", hint: "81 books" },
  { label: "4 Chapters a Day", to: "/study", hint: "the daily reading" },
  { label: "Sabbath Classes", to: "/classes", hint: "class notes" },
  { label: "The Captains", to: "/captains", hint: "episodes" },
  { label: "Case Studies", to: "/cases", hint: "judgments and blessings" },
];

let opener: ((open: boolean) => void) | null = null;
export function openCommand() { opener?.(true); }

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [books, setBooks] = useState<Book[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    opener = setOpen;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((v) => !v); }
      else if (e.key === "/" && !typing) { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); opener = null; };
  }, []);

  useEffect(() => {
    if (open && !books) api.books().then(setBooks).catch(() => setBooks([]));
    if (!open) setQ("");
  }, [open, books]);

  const go = (to: string) => { setOpen(false); navigate({ href: to } as never); };
  const query = q.trim();
  // "psalms 23", "1 samuel 17", "john 3:16"
  const ref = query.match(/^([1-3]?\s?[a-z]+(?:\s[a-z]+)?)\s+(\d+)(?::(\d+))?$/i);
  const refBook = ref && books ? books.find((b) => b.book.toLowerCase() === ref[1].toLowerCase().replace(/\s+/g, " ")) : null;

  return (
    <Command.Dialog open={open} onOpenChange={setOpen} label="Command menu" className="cmd__root" contentClassName="cmd" overlayClassName="cmd__overlay" shouldFilter={true} loop>
      <div className="cmd__prompt" aria-hidden="true">~/cyberjudah<b>$</b></div>
      <Command.Input value={q} onValueChange={setQ} placeholder="Search the library, or jump to a book" autoFocus />
      <Command.List>
        <Command.Empty>Nothing matches. Press Enter to search the library for it.</Command.Empty>
        {query ? (
          <Command.Group heading="Search">
            {refBook ? (
              <Command.Item value={`open ${query}`} onSelect={() => go(`/bible/${refBook.slug}/${ref![2]}${ref![3] ? `#v${ref![3]}` : ""}`)}>
                Open {refBook.book} {ref![2]}{ref![3] ? `:${ref![3]}` : ""}<span className="cmd__hint">chapter</span>
              </Command.Item>
            ) : null}
            <Command.Item value={`search ${query}`} onSelect={() => go(`/search?q=${encodeURIComponent(query)}`)}>
              Search for “{query}”<span className="cmd__hint">every verse, note, law and case</span>
            </Command.Item>
          </Command.Group>
        ) : null}
        <Command.Group heading="Go to">
          {SECTIONS.map((s) => (
            <Command.Item key={s.to} value={s.label} onSelect={() => go(s.to)}>{s.label}<span className="cmd__hint">{s.hint}</span></Command.Item>
          ))}
        </Command.Group>
        {books?.length ? (
          <Command.Group heading="Books">
            {books.map((b) => (
              <Command.Item key={b.slug} value={`${b.book} book`} onSelect={() => go(`/bible/${b.slug}/1`)}>{b.book}<span className="cmd__hint">{b.chapters} chapters</span></Command.Item>
            ))}
          </Command.Group>
        ) : null}
      </Command.List>
      <div className="cmd__foot" aria-hidden="true"><kbd>↑↓</kbd> move <kbd>↵</kbd> open <kbd>esc</kbd> close</div>
    </Command.Dialog>
  );
}
