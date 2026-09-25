import { createServerFn } from '@tanstack/react-start';
import { passageExcerpt } from './passage-excerpt';
import { parseQuery, ftsExpr } from './search-query';
import type { TeachingRef } from './teaching-refs';
export type Passage = { title: string; matchedTitle: string; excerpt: string; feed: string; date: string; video: string; start: number; note: string; timing: 'caption' | 'passage' };
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
      const sql = `SELECT title, highlight(teaching_passages,0,char(57344),char(57345)) AS matchedTitle, highlight(teaching_passages,1,char(57344),char(57345)) AS matchedText, feed,date,video,start,note,cues FROM teaching_passages WHERE teaching_passages MATCH ? AND (? = '' OR feed = ?) ORDER BY bm25(teaching_passages,4,1), rowid LIMIT 21 OFFSET ?`;
      type IndexedPassage = Omit<Passage, 'excerpt' | 'timing'> & { matchedText: string; cues: string | null };
      const query = (statement: string) => env.DB!.prepare(statement)
        .bind(ftsExpr(parsed,'AND'), data.feed, data.feed, data.page * 20).all<IndexedPassage>();
      let result;
      try { result = await query(sql); }
      catch (error) {
        // Allow the app deployment to precede the one-time caption-offset index migration.
        if (!String(error).includes('no such column: cues')) throw error;
        result = await query(sql.replace('note,cues FROM', 'note,NULL AS cues FROM'));
      }
      return { hits: result.results.slice(0,20).map(({matchedText,cues,...hit}) => ({...hit,...passageExcerpt(matchedText,cues,hit.start)})), more: result.results.length > 20, unavailable: false };
    } catch { return { ...empty, unavailable: true }; }
  });

/**
 * The recordings that taught a chapter (or the selected verses) most, newest first on ties,
 * with every moment each one did. `total` counts all matching recordings.
 */
const taughtSql = `WITH hits AS (
  SELECT * FROM teaching_refs WHERE slug = ?1 AND chapter = ?2
    AND (?3 = '[]' OR EXISTS (SELECT 1 FROM json_each(?3) AS v WHERE v.value BETWEEN first AND coalesce(last, first)))
), top AS (
  SELECT video, count(*) AS n, max(coalesce(date, '')) AS d FROM hits GROUP BY video ORDER BY n DESC, d DESC, video LIMIT 100
)
SELECT h.first, h.last, h.video, h.start, h.timing, h.title, h.feed, h.date, h.note, h.heard,
  (SELECT count(DISTINCT video) FROM hits) AS total
FROM hits AS h JOIN top USING (video) ORDER BY top.n DESC, top.d DESC, h.video, h.start`;

/** Where one chapter was taught (see scripts/corpus/index.py for the table). */
export const taughtInChapter = createServerFn({ method: 'GET' })
  .inputValidator((s: { slug: string; chapter: number; verses?: number[] }) => ({
    slug: /^[a-z0-9-]{1,40}$/.test(String(s.slug)) ? String(s.slug) : '',
    chapter: Math.min(200, Math.max(0, Math.floor(Number(s.chapter) || 0))),
    verses: (Array.isArray(s.verses) ? s.verses : []).map(Number).filter(v => Number.isInteger(v) && v > 0 && v < 200).slice(0, 200),
  }))
  .handler(async ({ data }) => {
    const empty = { rows: [] as TeachingRef[], total: 0, unavailable: false };
    if (!data.slug || !data.chapter) return empty;
    try {
      const { env } = await import('cloudflare:workers');
      if (!env.DB) return { ...empty, unavailable: true };
      const result = await env.DB.prepare(taughtSql).bind(data.slug, data.chapter, JSON.stringify(data.verses)).all<TeachingRef & { total: number }>();
      const rows = result.results;
      return { rows, total: rows[0]?.total ?? 0, unavailable: false };
    } catch { return { ...empty, unavailable: true }; }
  });
