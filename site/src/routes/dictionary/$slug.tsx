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
    <h1 className="cj-h1">{entry.term}</h1>
    <RefCards>
      <article aria-label={`${entry.term} dictionary entry`} style={{ maxWidth: '75ch', overflowWrap: 'anywhere', lineHeight: 1.8 }}>
        {entry.paragraphs.map((paragraph, i) => <p key={i}>{paragraph.map((part, j) => part.href ? <a key={j} href={part.href} data-verses={part.verses}>{part.text}</a> : part.text)}</p>)}
      </article>
    </RefCards>
  </Page>;
}
