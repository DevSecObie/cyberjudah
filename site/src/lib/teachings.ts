import { createServerFn } from '@tanstack/react-start';
import { parseQuery, ftsExpr } from './search-query';
export type Passage = { title: string; excerpt: string; feed: string; date: string; video: string; start: number; note: string };
export const searchTeachings = createServerFn({ method: 'GET' })
  .inputValidator((s: { q: string; feed?: string; page?: number }) => ({
    q: String(s.q || '').slice(0,200),
    feed: ['classes','captains','history'].includes(s.feed || '') ? s.feed : '',
    page: Math.min(1000, Math.max(0, Math.floor(Number(s.page) || 0))),
  }))
  .handler(async ({ data }) => {
    const empty = { hits: [] as Passage[], more: false, unavailable: false };
    const parsed = parseQuery(data.q);
    if (!parsed.terms.length && !parsed.phrases.length) return empty;
    try {
      const { env } = await import('cloudflare:workers');
      if (!env.DB) return { ...empty, unavailable: true };
      const result = await env.DB.prepare(`SELECT title, snippet(teaching_passages,1,'','',' … ',48) AS excerpt, feed,date,video,start,note FROM teaching_passages WHERE teaching_passages MATCH ? AND (? = '' OR feed = ?) ORDER BY bm25(teaching_passages,4,1), rowid LIMIT 21 OFFSET ?`)
        .bind(ftsExpr(parsed,'AND'), data.feed, data.feed, data.page * 20).all<Passage>();
      return { hits: result.results.slice(0,20), more: result.results.length > 20, unavailable: false };
    } catch { return { ...empty, unavailable: true }; }
  });
