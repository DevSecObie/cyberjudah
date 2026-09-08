import { createServerFn } from '@tanstack/react-start';

// Loaded only inside the server handler: visitors receive a bounded result page,
// not the complete dictionary in their JavaScript bundle.
export const lookupDictionary = createServerFn({ method: 'GET' })
  .inputValidator((input: { q?: string; letter?: string; page?: number; slug?: string }) => ({
    q: String(input.q ?? '').trim().slice(0, 120),
    letter: /^[A-Z]$/.test(input.letter ?? '') ? input.letter! : '',
    page: Math.min(1000, Math.max(1, Math.floor(Number(input.page) || 1))),
    slug: String(input.slug ?? '').slice(0, 200),
  }))
  .handler(async ({ data }) => {
    const { default: entries } = await import('../data/dictionary/easton.json');
    const entry = data.slug ? entries.find(e => e.slug === data.slug) ?? null : null;
    const matches = entries.filter(e => (!data.letter || e.term.toUpperCase().startsWith(data.letter)) && (!data.q || e.term.toLowerCase().includes(data.q.toLowerCase())));
    const pages = Math.max(1, Math.ceil(matches.length / 60));
    const page = Math.min(data.page, pages);
    return { entry, total: entries.length, count: matches.length, page, pages,
      rows: data.slug ? [] : matches.slice((page - 1) * 60, page * 60).map(({ slug, term }) => ({ slug, term })) };
  });
