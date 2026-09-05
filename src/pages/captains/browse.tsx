import React from "react";
import Link from "@docusaurus/Link";
import NoteBrowser from "@site/src/components/NoteBrowser";

export default function Browse() {
  return (
    <NoteBrowser
      src="/search/captains.json"
      title="15 Minutes w/ The Captains"
      heading="15 Minutes w/ The Captains"
      description="Browse the 15 Minutes w/ The Captains episode notes by topic, book, teacher, year or name"
      noun={["episode", "episodes"]}
      intro={<>
        Short teachings from the captains, written up in full. Narrow by topic, by the book of
        scripture it opens, or by who taught it.{" "}
        <Link to="/captains">Read them as a feed</Link> instead, or go to the{" "}
        <Link to="/classes/browse">Sabbath class notes</Link>.
      </>}
    />
  );
}
