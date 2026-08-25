import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";

const sections: [string, string][] = [
  ["/bible", "Bible"], ["/study", "Study Notes"], ["/classes", "Class Notes"], ["/encyclopedia", "Encyclopedia"],
  ["/law", "The Law"], ["/precepts", "Precepts"], ["/cases", "Case Studies"], ["/concordance", "Concordance"],
  ["/search", "Search"], ["/api", "API"], ["/downloads", "Downloads"],
];
export default function Home() {
  return (
    <Layout title="CyberJudah">
      <main className="container margin-vert--lg">
        <ul>{sections.map(([to, label]) => <li key={to}><Link to={to}>{label}</Link></li>)}</ul>
      </main>
    </Layout>
  );
}
