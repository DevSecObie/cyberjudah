import { createFileRoute } from "@tanstack/react-router";
import { Page, Kicker, ReadLink } from "@/components/site/chrome";
import { Breadcrumbs } from "@/components/site/browse-tools";
import { CiteLanding } from "@/components/site/return-bar";
import { api } from "@/lib/api";
import { pageHead } from "@/lib/head";
import { DoctrineAnswers, DoctrineEmpty, loadDoctrine } from "./-shared";

export const Route = createFileRoute("/doctrine/$slug")({
  loader: ({ params }) => loadDoctrine(() => api.doctrineEntry(params.slug)),
  head: ({ loaderData, match }) => pageHead([{ title: loaderData?.data ? `${loaderData.data.name} · False Doctrines · CyberJudah` : "False Doctrines · CyberJudah" }], match),
  component: DoctrinePage,
});

function DoctrinePage() {
  const result = Route.useLoaderData();
  const entry = result.data;
  return <Page>
    <Breadcrumbs items={[{ label: "False Doctrines", to: "/doctrine" }, ...(entry ? [{ label: entry.name }] : [])]} />
    <Kicker>False Doctrines</Kicker>
    <h1 className="cj-h1">{entry?.name ?? "False Doctrines"}</h1>
    {entry ? <CiteLanding><DoctrineAnswers entry={entry} /></CiteLanding> : <DoctrineEmpty error={result.error ?? "unavailable"} />}
    <p><ReadLink to="/doctrine">All false doctrines</ReadLink></p>
  </Page>;
}
