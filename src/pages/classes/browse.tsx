import React from "react";
import Link from "@docusaurus/Link";
import NoteBrowser from "@site/src/components/NoteBrowser";

export default function Browse() {
  return (
    <NoteBrowser
      src="/search/classes.json"
      title="Class notes"
      heading="Sabbath class notes"
      description="Browse the Sabbath class notes by topic, book, teacher, year or name"
      noun={["class", "classes"]}
      intro={<>
        Every class written up in full. Narrow by topic, by the book of scripture it opens,
        by who taught it, or by year.{" "}
        <Link to="/classes">Read them as a feed</Link> instead, or see{" "}
        <Link to="/classes/by-book">which classes open which book</Link>.
      </>}
    />
  );
}
