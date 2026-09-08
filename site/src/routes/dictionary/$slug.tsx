import { createFileRoute, notFound } from '@tanstack/react-router';
import { Page } from '@/components/site/chrome';
import { Breadcrumbs } from '@/components/site/browse-tools';
import { lookupDictionary } from '@/lib/dictionary';
import { RefCards } from '@/components/site/ref-card';

export const Route = createFileRoute('/dictionary/$slug')({
  loader: async ({ params }) => {
    const { entry } = await lookupDictionary({ data: { slug: params.slug } });
    if (!entry) throw notFound();
    return entry;
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.term ?? 'Entry not found'} · Dictionary · CyberJudah` }] }),
  component: Entry,
});
function Entry() {
  const entry = Route.useLoaderData();
  return <Page>
    <Breadcrumbs items={[{ label: 'Dictionary', to: '/dictionary' }, { label: entry.term }]} />
    <div className="dictionary-heading">
      <div><p className="cj-kicker">Dictionary</p><h1 className="cj-h1">{entry.term}</h1></div>
      <form action="/dictionary" method="get" role="search" className="dictionary-lookup">
        <label htmlFor="entry-lookup">Find another term</label>
        <div><input id="entry-lookup" name="q" maxLength={120} placeholder="Search the dictionary" /><button type="submit" className="chip">Search</button></div>
      </form>
    </div>
    <p className="dictionary-hint">Preview linked scripture by hovering, focusing, or tapping a reference.</p>
    <RefCards>
      <article className="dictionary-reading" aria-label={`${entry.term} dictionary entry`}>
        {entry.paragraphs.map((paragraph, i) => <p key={i}>{paragraph.map((part, j) => part.href ? <a key={j} href={part.href} data-verses={part.verses}>{part.text}</a> : part.text)}</p>)}
      </article>
    </RefCards>
  </Page>;
}
