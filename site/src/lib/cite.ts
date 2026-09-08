import { verseNumbers } from "@/lib/refs";

/**
 * Landing on the citation. A reader who follows "cited by" out of Exodus 20:13 into a class
 * note should arrive at the line where the class opened Exodus 20:13, not at the top of the
 * note, and should be able to get back. The origin travels as `?from=/bible/exodus/20?v=13`.
 */
export type From = { slug: string; chapter: number; verses: number[]; href: string; label?: string };

export function parseFrom(raw: unknown): From | null {
  if (typeof raw !== "string") return null;
  const m = raw.match(/^\/bible\/([a-z0-9-]+)\/(\d+)(?:\?v=([\d,\-]+))?$/);
  if (!m) return null;
  return { slug: m[1], chapter: Number(m[2]), verses: verseNumbers(m[3]), href: raw };
}

export function fromHref(slug: string, chapter: number, verses: number[] | string): string {
  const spec = typeof verses === "string" ? verses : compressVerses(verses);
  return `/bible/${slug}/${chapter}${spec ? `?v=${spec}` : ""}`;
}

/** [1,2,3,7] -> "1-3,7" */
export function compressVerses(nums: number[]): string {
  const s = [...new Set(nums)].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    out.push(j > i ? `${s[i]}-${s[j]}` : String(s[i]));
    i = j;
  }
  return out.join(",");
}

/** The verses a /bible/<book>/<chapter>#v.. link names; [] for the whole chapter. */
function linkVerses(href: string): { slug: string; chapter: number; verses: number[] } | null {
  const m = href.match(/^(?:https?:\/\/[^/]+)?(?:\/cyberjudah)?\/bible\/([a-z0-9-]+)\/(\d+)\/?(?:#v([\d,\-]+))?/i);
  if (!m) return null;
  return { slug: m[1].toLowerCase(), chapter: Number(m[2]), verses: verseNumbers(m[3]) };
}

/** The first link in `root` that cites the origin; a verse match beats a chapter match. */
export function findCiteLink(root: ParentNode, from: From): HTMLElement | null {
  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>("a[href*='/bible/']:not(.returnbar__link)"));
  let chapterHit: HTMLElement | null = null;
  for (const a of links) {
    const l = linkVerses(a.getAttribute("href") ?? "");
    if (!l || l.slug !== from.slug || l.chapter !== from.chapter) continue;
    if (from.verses.length && l.verses.some((v) => from.verses.includes(v))) return a;
    if (!chapterHit) chapterHit = a;
  }
  return chapterHit;
}

/** Scroll the citing line into view and light it for a moment. */
export function landOn(el: HTMLElement, container?: HTMLElement | null) {
  const line = (el.closest("p, li, blockquote, h2, h3, .law") as HTMLElement | null) ?? el;
  if (container) {
    const top = line.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    container.scrollTo({ top: Math.max(0, top - 80), behavior: "smooth" });
  } else {
    line.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  line.classList.add("cite-hit");
  el.classList.add("cite-hit__link");
  window.setTimeout(() => line.classList.remove("cite-hit"), 6000);
}
