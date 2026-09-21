import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Page } from '@/components/site/chrome';
import { searchTeachings } from '@/lib/teachings';
import { SearchHighlight } from '@/components/search-highlight';
import { pageHead } from '@/lib/head';
export const Route = createFileRoute('/teachings')({
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s.q === 'string' ? s.q : '', feed: typeof s.feed === 'string' ? s.feed : '', page: Math.min(1001, Math.max(1, Math.floor(Number(s.page) || 1))) }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => searchTeachings({ data: { ...deps, page: deps.page - 1 } }),
  head: ({ match }) => pageHead([{ title: 'Search Teachings · CyberJudah' }], match),
  pendingComponent: () => <Page><p role="status">Searching teachings…</p></Page>,
  component: Teachings,
});
const collections: Record<string,string> = { classes: 'Classes', captains: 'Captains', history: 'Our Hidden History' };
function timestamp(value: number) { const n = Math.max(0,Math.floor(Number(value)||0)); return n >= 3600 ? `${Math.floor(n/3600)}:${String(Math.floor(n/60)%60).padStart(2,'0')}:${String(n%60).padStart(2,'0')}` : `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`; }
function Teachings() {
  const search = Route.useSearch(); const result = Route.useLoaderData(); const navigate = useNavigate();
  const [q,setQ] = useState(search.q); const [feed,setFeed] = useState(search.feed);
  useEffect(() => { setQ(search.q); setFeed(search.feed); }, [search.q,search.feed]);
  return <Page>
    <p className="cj-kicker">The teaching library</p><h1 className="cj-h1">Search teachings.</h1>
    <p className="cj-lede">Find a passage. Open the recording where it was spoken. Read the class notes alongside it.</p>
    <form role="search" onSubmit={e => { e.preventDefault(); navigate({ to:'/teachings', search:{q:q.trim(),feed,page:1} }); }} style={{margin:'2rem 0'}}>
      <div className="search-form"><input aria-label="Search teachings" placeholder='Try forgiveness or "love thy neighbour"' value={q} onChange={e=>setQ(e.target.value)} maxLength={200}/><button className="search-go" type="submit">Search</button></div>
      <label style={{display:'block',marginTop:'1rem'}}>Collection <select value={feed} onChange={e=>{ setFeed(e.target.value); if (search.q) navigate({to:'/teachings',search:{q:search.q,feed:e.target.value,page:1}}); }} style={{padding:'.6rem',marginLeft:'.75rem',color:'inherit',background:'var(--color-bg)'}}><option value="">All collections</option>{Object.entries(collections).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>
    </form>
    <p style={{marginBottom:'1rem',color:'var(--color-muted)'}}>Search words together, or use quotation marks for an exact phrase. Matching words are highlighted. Transcript captions may contain errors.</p>
    {!search.q && <div><p style={{marginTop:'1rem'}}>Explore: {['forgiveness','Sabbath','Isaiah'].map(term=><Link key={term} to="/teachings" search={{q:term,feed:'',page:1}} style={{marginRight:'1rem'}}>{term}</Link>)}</p></div>}
    {result.unavailable ? <p role="status">Teaching search is currently unavailable. Please try again later. <Link to="/search" search={{q:search.q,only:undefined}}>Search published notes and scripture</Link></p> : search.q && <>
      <p className="cj-mono" role="status">{result.hits.length ? `Results ${(search.page-1)*20+1}–${(search.page-1)*20+result.hits.length} for “${search.q}” · Page ${search.page}` : 'No matching passages. Try fewer words or another collection.'}</p>
      {result.hits.map((hit,i)=><article key={`${hit.video}:${hit.start}:${i}`} style={{padding:'1.5rem 0',borderBottom:'1px solid var(--color-muted)'}}>
        <p className="cj-mono">{collections[hit.feed] || hit.feed} · {hit.date || 'Date unavailable'} · {timestamp(hit.start)}</p>
        <h2 style={{fontSize:'1.5rem',margin:'.5rem 0'}}><a href={`https://www.youtube.com/watch?v=${encodeURIComponent(hit.video)}&t=${Math.max(0,Math.floor(Number(hit.start)||0))}s`} target="_blank" rel="noreferrer">{<SearchHighlight text={hit.matchedTitle || hit.title} />}</a></h2>
        <p style={{lineHeight:1.7}}><SearchHighlight text={hit.excerpt} /></p>
        <div style={{display:'flex',gap:'1.5rem',marginTop:'.75rem'}}><a href={`https://www.youtube.com/watch?v=${encodeURIComponent(hit.video)}&t=${Math.max(0,Math.floor(Number(hit.start)||0))}s`} target="_blank" rel="noreferrer">{hit.timing === 'caption' ? 'Watch match at' : 'Watch passage from'} {timestamp(hit.start)} ↗</a>{hit.note && <Link to={hit.note as never}>Read notes →</Link>}</div>
      </article>)}
      <nav aria-label="Result pages" style={{display:'flex',gap:'2rem',marginTop:'2rem'}}>{search.page>1 && <Link to="/teachings" search={{...search,page:search.page-1}}>← Previous</Link>}{result.more && <Link to="/teachings" search={{...search,page:search.page+1}}>Next →</Link>}</nav>
    </>}
  </Page>;
}
