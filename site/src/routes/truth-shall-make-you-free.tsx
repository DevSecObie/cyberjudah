import { createFileRoute } from "@tanstack/react-router";
import { Page, Kicker, ReadLink } from "@/components/site/chrome";
import { pageHead } from "@/lib/head";

const PLAYLIST_ID = "PLnnrx2V-o7VxaHaFzrEECeIR8NZ1x4zfx";
const PLAYLIST_URL = `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`;

export const Route = createFileRoute("/truth-shall-make-you-free")({
  head: ({ match }) => pageHead([
    { title: "Truth Shall Make You Free · CyberJudah" },
    { name: "description", content: "IUIC The Truth Shall Make You Free teaching series, gathered into one playlist." },
  ], match),
  component: TruthShallMakeYouFree,
});

function TruthShallMakeYouFree() {
  return (
    <Page>
      <Kicker>Teaching</Kicker>
      <h1 className="cj-h1">Truth Shall Make You Free.</h1>
      <p className="cj-lede">The original IUIC teaching series gathered in one place: subjects from the holy days and the history of Israel to the law, the covenants, faith and daily life.</p>
      <div style={{ marginTop: "clamp(2rem, 5vw, 3.5rem)", maxWidth: "960px" }}>
        <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", overflow: "hidden", background: "#05070a", border: "1px solid rgba(255,255,255,.16)" }}>
          <iframe
            src={`https://www.youtube-nocookie.com/embed/videoseries?list=${PLAYLIST_ID}`}
            title="IUIC The Truth Shall Make You Free playlist"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
          />
        </div>
        <p className="cj-mono" style={{ marginTop: "1rem" }}>24 available videos · 5 unavailable videos are hidden by YouTube</p>
        <p style={{ marginTop: "1.25rem" }}><ReadLink href={PLAYLIST_URL}>Open the full playlist on YouTube</ReadLink></p>
      </div>
    </Page>
  );
}
