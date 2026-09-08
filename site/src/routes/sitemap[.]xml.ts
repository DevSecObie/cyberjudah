import { createFileRoute } from "@tanstack/react-router";

import { api } from "@/lib/api";

const SECTIONS = ["/", "/bible", "/study", "/classes", "/captains", "/history", "/cases", "/law", "/precepts", "/concordance", "/encyclopedia", "/topics", "/search", "/api", "/downloads", "/about"];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const today = new Date().toISOString().split("T")[0];
        const urls: string[] = SECTIONS.map((p) => `${origin}${p}`);
        try {
          const [books, notes] = await Promise.all([api.books(), api.notes()]);
          for (const b of books) for (const c of b.chapterIds) urls.push(`${origin}/bible/${b.slug}/${c}`);
          for (const b of books) { urls.push(`${origin}/bible/${b.slug}`); urls.push(`${origin}/concordance/${b.slug}`); }
          for (const n of notes) if (/^\/(study|classes|captains|encyclopedia)\//.test(n.url)) urls.push(`${origin}${n.url}`);
          for (const b of new Set(notes.filter((n) => n.kind === "study" && n.book).map((n) => n.url.split("/")[2]))) urls.push(`${origin}/study/${b}`);
          const [cases, laws, precepts, topics] = await Promise.all([api.cases(), api.laws(), api.precepts(), api.topics()]);
          for (const c of cases.cases) urls.push(`${origin}${c.url}`);
          for (const p of laws) { urls.push(`${origin}${p.url}`); for (const s of p.sections) urls.push(`${origin}${s.url}`); }
          for (const p of precepts) urls.push(`${origin}${p.url}`);
          for (const t of topics) urls.push(`${origin}${t.url}`);
          for (const h of await api.history()) urls.push(`${origin}${h.url}`);
        } catch { /* the sections alone are still a valid sitemap */ }
        const xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...urls.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`), "</urlset>"].join("\n");
        return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});
