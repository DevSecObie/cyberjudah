import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/brand";

type Meta = Record<string, string | undefined>;
type MatchLike = { pathname?: string } | undefined;

/**
 * Per-page head. Every route already sets a title and usually a description; this adds the
 * matching Open Graph and Twitter tags and a canonical link so a shared link, a search result
 * and a bookmark all describe the page rather than the site. Query strings are dropped from
 * the canonical so search and filter pages point at their base page.
 */
export function pageHead(meta: Meta[], match?: MatchLike, extra?: { type?: "website" | "article"; image?: string }) {
  const title = meta.find((m) => m.title)?.title ?? SITE_NAME;
  const description = meta.find((m) => m.name === "description")?.content || SITE_DESCRIPTION;
  const path = (match?.pathname ?? "/").replace(/\/+$/, "") || "/";
  const url = `${SITE_URL}${path === "/" ? "/" : path}`;
  const image = extra?.image ?? `${SITE_URL}/og.jpg`;
  const known = new Set(["title", "description"]);
  const rest = meta.filter((m) => !m.title && !(m.name && known.has(m.name)));
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:type", content: extra?.type ?? "website" },
      { property: "og:image", content: image },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
      ...rest,
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
