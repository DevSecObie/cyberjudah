import { createFileRoute } from "@tanstack/react-router";

import { api } from "@/lib/api";

const SECTIONS = ["/", "/bible", "/study", "/classes", "/captains", "/cases", "/search"];

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
          for (const n of notes) if (/^\/(study|classes|captains)\//.test(n.url)) urls.push(`${origin}${n.url}`);
          const cases = await api.cases();
          for (const c of cases.cases) urls.push(`${origin}${c.url}`);
        } catch { /* the sections alone are still a valid sitemap */ }
        const xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...urls.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`), "</urlset>"].join("\n");
        return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});
