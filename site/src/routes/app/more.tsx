import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Row, Screen, Section } from "@/components/app/ui";
import { sharePage, tg } from "@/lib/telegram";

export const Route = createFileRoute("/app/more")({ component: More });

const STUDY: [string, string, string][] = [
  ["/study", "4 Chapters a Day", "The daily reading, a note for every chapter"],
  ["/encyclopedia", "Encyclopedia", "Standing subjects, book by book"],
  ["/topics", "Topics", "Classes and episodes by what they cover"],
  ["/dictionary", "Dictionary", "What a word or a name means"],
  ["/concordance", "Concordance", "Everything that cites a chapter"],
];
const LAW: [string, string, string][] = [
  ["/law", "The Law", "The handbook, every law with its scripture"],
  ["/precepts", "Precepts", "Every subject scripture speaks to, A to Z"],
  ["/cases", "Case studies", "Judgments, and those who kept the law and were blessed"],
];

function More() {
  const [pin, setPin] = useState(false);
  const app = tg();
  useEffect(() => {
    if (app?.isVersionAtLeast("8.0")) app.checkHomeScreenStatus((s) => setPin(s === "missed" || s === "unknown"));
  }, [app]);
  return (
    <Screen title="More">
      <Section title="Study">
        <div className="app-list">{STUDY.map(([to, t, s]) => <Row key={to} href={to} title={t} sub={s} />)}</div>
      </Section>
      <Section title="Law">
        <div className="app-list">{LAW.map(([to, t, s]) => <Row key={to} href={to} title={t} sub={s} />)}</div>
      </Section>
      <Section title="CyberJudah">
        <div className="app-list">
          {app ? <Row onClick={() => sharePage(undefined, "CyberJudah: the KJV with everything taught from it")} title="Share the app" sub="Send it to a chat" /> : null}
          {pin ? <Row onClick={() => app?.addToHomeScreen()} title="Add to Home Screen" sub="Open CyberJudah in one tap" /> : null}
          <Row href="/about" title="About" sub="Where the text and the notes come from" />
          <Row onClick={() => (app ? app.openLink("https://cyberjudah.io") : window.open("https://cyberjudah.io", "_blank", "noopener"))} title="Open the full website" sub="cyberjudah.io" />
        </div>
      </Section>
    </Screen>
  );
}
