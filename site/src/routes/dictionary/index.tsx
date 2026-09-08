import { createFileRoute, Link } from '@tanstack/react-router';
import { Page } from '@/components/site/chrome';
import { Breadcrumbs } from '@/components/site/browse-tools';
import { lookupDictionary } from '@/lib/dictionary';

export const Route = createFileRoute('/dictionary/')({
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s.q === 'string' ? s.q.slice(0,120) : '', letter: typeof s.letter === 'string' && /^[A-Z]$/.test(s.letter) ? s.letter : '', page: Math.max(1, Math.min(1000, Math.floor(Number(s.page) || 1))) }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => lookupDictionary({ data: deps }),
  head: () => ({ meta: [{ title: 'Bible Dictionary · CyberJudah' }] }),
  component: Dictionary,
});

function Dictionary() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  return <Page>
    <Breadcrumbs items={[{ label: 'Dictionary' }]} />
    <h1 className="cj-h1">Bible Dictionary.</h1>
    <p className="cj-lede">{data.total.toLocaleString()} entries. Find a term or browse by letter.</p>
    <form action="/dictionary" method="get" role="search" className="filters dictionary-search">
      <label htmlFor="dictionary-query">Find a term</label>
      <input key={search.q} id="dictionary-query" name="q" defaultValue={search.q} maxLength={120} placeholder="Aaron, cubit, covenant…" />
      <button type="submit" className="chip">Search</button>
      <Link to="/dictionary" search={{ q: '', letter: '', page: 1 }} className="chip">Clear</Link>
    </form>
    <nav aria-label="Dictionary alphabet" className="era-jumps dictionary-alphabet">
      {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => <Link key={letter} to="/dictionary" search={{ q: '', letter, page: 1 }} aria-current={search.letter === letter ? 'page' : undefined}>{letter}</Link>)}
    </nav>
    <p role="status">{data.count.toLocaleString()} entries · Page {data.page} of {data.pages}</p>
    {!data.count && <p>No matching terms. Try another spelling or browse by letter.</p>}
    <ul className="dictionary-terms">{data.rows.map(row => <li key={row.slug}><Link to="/dictionary/$slug" params={{ slug: row.slug }}>{row.term}<span aria-hidden="true">↗</span></Link></li>)}</ul>
    <nav aria-label="Dictionary pages" className="pager">
      {data.page > 1 && <Link to="/dictionary" search={{ ...search, page: data.page - 1 }}>← Previous</Link>}
      {data.page < data.pages && <Link to="/dictionary" search={{ ...search, page: data.page + 1 }}>Next →</Link>}
    </nav>
  </Page>;
}
