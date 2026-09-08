import { createFileRoute, Link } from "@tanstack/react-router";
import { Page } from "@/components/site/chrome";
import { api, type CaseRow } from "@/lib/api";

export const Route = createFileRoute("/cases/")({
  loader: () => api.cases(),
  head: () => ({ meta: [{ title: "Case Studies · CyberJudah" }, { name: "description", content: "Every judgment scripture records, and everyone it records who kept the law and was blessed for it, by era." }] }),
  component: CasesIndex,
});

const VERDICT: Record<string, string> = { death: "Put to death", plague: "Plague", exile: "Exile", captivity: "Captivity", curse: "Cursed", restitution: "Restitution", spared: "Spared", reprieve: "Reprieve", temporal: "Temporal judgment", unrecorded: "Sentence not recorded", blessed: "Kept the law" };

function Row({ c }: { c: CaseRow }) {
  return (
    <li>
      <Link to={c.url as never}>
        <span><span style={{ display: "block" }}>{c.name}</span><span className="cj-mono" style={{ display: "block", marginTop: "0.15rem", letterSpacing: 0, fontFamily: "inherit", fontSize: "0.92rem" }}>{c.charge}</span></span>
        <span className={`verdict verdict--${c.verdict}`}>{VERDICT[c.verdict] ?? c.verdict}</span>
      </Link>
    </li>
  );
}

function CasesIndex() {
  const data = Route.useLoaderData();
  const judged = data.cases.filter((c) => c.kind !== "blessing").length;
  const kept = data.cases.length - judged;
  return (
    <Page>
      <h1 className="cj-h1">Case Studies.</h1>
      <p className="cj-lede">{judged} judgments scripture records, and {kept} who kept the law and were blessed for it, by era. Each case carries the offense or the obedience, the sentence or the blessing, the scripture, and the laws it turned on.</p>
      {data.eras.map((era) => {
        const list = data.cases.filter((c) => c.era === era);
        if (!list.length) return null;
        const j = list.filter((c) => c.kind !== "blessing"), b = list.filter((c) => c.kind === "blessing");
        return (
          <section key={era} className="book-block">
            <h2>{era}</h2>
            <ul className="list">{j.map((c) => <Row key={c.slug} c={c} />)}</ul>
            {b.length ? (
              <>
                <p className="cj-kicker" style={{ marginTop: "1.2rem" }}>Kept the law</p>
                <ul className="list">{b.map((c) => <Row key={c.slug} c={c} />)}</ul>
              </>
            ) : null}
          </section>
        );
      })}
    </Page>
  );
}
