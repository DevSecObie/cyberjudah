import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: false });

/**
 * The notes arrive as the markdown the publication is written in: verse blockquotes with
 * superscript verse links, a few raw HTML wrappers, and site-relative links that match this
 * site's routes one for one (/bible/<book>/<chapter>#v<n>, /study/..., /classes/...).
 */
export function renderNote(markdown: string): string {
  const src = markdown
    .replace(/<!--\s*truncate\s*-->/g, "")
    // The class video mount becomes a privacy-enhanced YouTube embed.
    .replace(/<div class="class-video-mount" data-video-id="([\w-]{11})"><\/div>/g, (_m, id) =>
      `<div class="note-video"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="Class recording" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`);
  return marked.parse(src) as string;
}

/** A short plain-text lede for descriptions and cards: the first paragraph without markup. */
export function plainLede(markdown: string, max = 180): string {
  const text = markdown
    .replace(/<[^>]+>/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}
