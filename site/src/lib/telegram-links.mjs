/**
 * Telegram deep links. A Mini App link carries one `startapp` value, limited by Telegram to
 * A-Z a-z 0-9 _ - and 512 characters, so a page path is written with `_` for `/` (no slug in
 * the library uses an underscore). A Bible chapter may carry its verses as a last segment,
 * ranges joined by `x`, and the `bible_` prefix may be left off, so a person can type
 * `john_3_16` or `psalms_23`:
 *
 *   bible_john_3_16-18   ->  /bible/john/3?v=16-18#v16
 *   john_3_16x18         ->  /bible/john/3?v=16,18#v16
 *   classes_2026_slug    ->  /classes/2026/slug
 *   (empty)              ->  /
 */

const SECTIONS = new Set([
  "about", "api", "bible", "captains", "cases", "classes", "concordance", "dictionary", "downloads",
  "encyclopedia", "history", "law", "precepts", "search", "study", "teachings", "topics", "truth-shall-make-you-free",
]);

const SAFE = /^[A-Za-z0-9_-]{1,512}$/;
const SEGMENT = /^[a-z0-9-]+$/;
const VERSES = /^\d+(-\d+)?(x\d+(-\d+)?)*$/;

export function startParamToPath(param) {
  if (typeof param !== "string" || !SAFE.test(param)) return "/";
  const parts = param.toLowerCase().split("_").filter(Boolean);
  if (!parts.length || !parts.every((p) => SEGMENT.test(p))) return "/";
  if (!SECTIONS.has(parts[0])) parts.unshift("bible");
  if (parts[0] === "bible" && parts.length === 4 && /^\d+$/.test(parts[2]) && VERSES.test(parts[3])) {
    const v = parts[3].replace(/x/g, ",");
    return `/bible/${parts[1]}/${parts[2]}?v=${v}#v${v.match(/^\d+/)[0]}`;
  }
  return `/${parts.join("/")}`;
}

export function pathToStartParam(pathname, verses) {
  const parts = String(pathname).split("/").filter(Boolean);
  if (!parts.every((p) => SEGMENT.test(p))) return "";
  if (parts[0] === "bible" && parts.length === 3 && verses && /^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(verses)) parts.push(verses.replace(/,/g, "x"));
  const param = parts.join("_");
  return param.length <= 512 ? param : "";
}

/** The t.me link that opens this page in the Mini App, or the plain site URL when none is configured. */
export function appLink(appUrl, siteUrl, pathname, verses) {
  if (!appUrl) return `${siteUrl}${pathname === "/" ? "" : pathname}${verses ? `?v=${verses}` : ""}`;
  const param = pathToStartParam(pathname, verses);
  return param ? `${appUrl}?startapp=${param}` : appUrl;
}

/**
 * The Mini App's own screens live under /app. A site path that has an app screen maps to
 * it (a chapter to the reader, a class or study note to the note view, a section to its
 * tab); anything else returns null and opens as the website page.
 */
const NOTE_SECTIONS = new Set(["classes", "captains", "history", "study", "encyclopedia"]);
const FEEDS = { classes: "classes", captains: "captains", history: "history", "truth-shall-make-you-free": "truth" };

export function toAppPath(href) {
  let url;
  try { url = new URL(String(href), "https://app.invalid"); } catch { return null; }
  if (url.origin !== "https://app.invalid") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const [top] = parts;
  if (!top) return "/app";
  if (top === "app") return url.pathname + url.search + url.hash;
  if (top === "bible") {
    if (parts.length === 1) return "/app/bible";
    if (parts.length === 2) return `/app/bible?book=${parts[1]}`;
    if (parts.length === 3 && /^\d+$/.test(parts[2])) return `/app/read/${parts[1]}/${parts[2]}${url.search}${url.hash}`;
    return null;
  }
  if (top === "search") return `/app/search${url.search}`;
  if (Object.hasOwn(FEEDS, top) && parts.length === 1) return `/app/classes?feed=${FEEDS[top]}`;
  if (NOTE_SECTIONS.has(top) && parts.length > 1) return `/app/note${url.pathname}${url.hash}`;
  return null;
}

/** The website page an app screen shows, for share links and "open in browser". */
export function sitePathOf(pathname) {
  const parts = String(pathname).split("/").filter(Boolean);
  if (parts[0] !== "app") return String(pathname) || "/";
  if (parts[1] === "read" && parts.length === 4) return `/bible/${parts[2]}/${parts[3]}`;
  if (parts[1] === "note" && parts.length > 2) return `/${parts.slice(2).join("/")}`;
  if (parts[1] === "bible" || parts[1] === "search" || parts[1] === "classes") return `/${parts[1]}`;
  return "/";
}

/** Where a Telegram launch lands: the app screen for the start param, else the page. */
export function launchPath(param) {
  const site = startParamToPath(param).split("#")[0];
  return toAppPath(site) ?? site;
}
