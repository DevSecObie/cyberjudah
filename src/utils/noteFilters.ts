export type FilterableNote = {
  title: string; url: string; date: string; year: string; books: string[];
  allBooks?: string[]; topics?: string[]; teacher?: string;
};
export type NoteFilters = {
  q: string; years: string[]; topics: string[]; teachers: string[]; book: string;
  sort: "new" | "old" | "az";
};

export function notePath(url: string, base: string) {
  const pathname = new URL(url, "https://local.invalid").pathname.replace(/\.html$/, "").replace(/\/$/, "");
  const prefix = base.replace(/\/$/, "");
  return prefix && pathname.startsWith(prefix + "/") ? pathname.slice(prefix.length) : pathname;
}

export function filterNotes<T extends FilterableNote>(notes: T[], filters: NoteFilters, textUrls: Set<string> = new Set()): T[] {
  const { q, years, topics, teachers, book, sort } = filters;
  const term = q.trim().toLowerCase();
  return notes.filter((note) => {
    if (years.length && !years.includes(note.year)) return false;
    if (topics.length && !topics.every((topic) => (note.topics ?? []).includes(topic))) return false;
    if (teachers.length && !(note.teacher && teachers.includes(note.teacher))) return false;
    if (book && !(note.allBooks ?? note.books).includes(book)) return false;
    return !term || note.title.toLowerCase().includes(term) || (note.teacher ?? "").toLowerCase().includes(term) || textUrls.has(note.url);
  }).sort((a, b) => sort === "az" ? a.title.localeCompare(b.title)
    : (sort === "old" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)) || a.title.localeCompare(b.title));
}
