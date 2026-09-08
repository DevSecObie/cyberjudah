import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, Kicker } from "@/components/site/chrome";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About · CyberJudah" }, { name: "description", content: "What CyberJudah is, where the text and the notes come from, and how to report a correction." }] }),
  component: About,
});

function About() {
  return (
    <Page>
      <Kicker>About</Kicker>
      <h1 className="cj-h1">One passage, everything taught from it.</h1>
      <div className="note prose-page">
        <p>CyberJudah is a study library built around one idea: that a passage and everything taught from it belong on the same page. The scripture, the class notes, the daily reading, the handbook of law, the precepts and the case studies are one linked corpus rather than separate archives, so a citation in a class can be followed into the chapter it came from, and a chapter lists every note, law, precept and case that cites it.</p>
        <h2>What is here</h2>
        <table>
          <tbody>
            <tr><td><Link to="/bible">The scripture</Link></td><td>King James Version (1769) with the Apocrypha. 81 books, every chapter on its own page, every verse on its own anchor.</td></tr>
            <tr><td><Link to="/study">4 Chapters a Day</Link></td><td>Notes from the daily reading, in the order the books are read.</td></tr>
            <tr><td><Link to="/classes">Sabbath classes</Link></td><td>The classes written up in full, with the scriptures quoted where they were opened.</td></tr>
            <tr><td><Link to="/captains">15 Minutes w/ The Captains</Link></td><td>Short weekday teachings, one subject at a time.</td></tr>
            <tr><td><Link to="/encyclopedia">Encyclopedia</Link></td><td>Standing subjects gathered from across the notes.</td></tr>
            <tr><td><Link to="/law">The Law</Link>, <Link to="/precepts">Precepts</Link>, <Link to="/cases">Cases</Link></td><td>The handbook of Bible law, the precept index, and the judgments recorded in scripture with the law each one broke.</td></tr>
            <tr><td><Link to="/concordance">Concordance</Link></td><td>Chapter by chapter, everything that cites it. <Link to="/classes/by-book">Classes by book</Link> reads the same graph the other way.</td></tr>
            <tr><td><Link to="/api">API</Link>, <Link to="/downloads">Downloads</Link></td><td>The whole library as JSON and SQLite, and as an Obsidian vault.</td></tr>
          </tbody>
        </table>
        <h2>The text</h2>
        <p>The Bible text is the public-domain King James Version of 1769, with the Apocrypha, reproduced without alteration. Cross references come from a public-domain Treasury of Scripture Knowledge lineage, and the parallel translation in the reader is the World English Bible, also public domain.</p>
        <h2>The notes</h2>
        <p>Class and episode notes are written up from the recordings in the teacher's own words, with every scripture that was opened quoted in place from our own KJV text and linked back into the chapter. Where a note carries a recording, the timestamp beside each passage links into the video at the moment it was read.</p>
        <p>The teacher is recorded only where the class itself says who taught it. The rest are left blank rather than guessed at. Topic tags are derived from the text of each note against a controlled vocabulary and are meant for finding classes, not for classifying doctrine.</p>
        <p>Many recordings carry no reliable date. Where the date shown is inferred, from the Sabbath it falls on, from announcements made in the class, or from its place in the upload order, the note says so. Estimated dates are ordering information, not a claim about the calendar.</p>
        <h2>Corrections</h2>
        <p>Everything here is in the open. If a passage is misquoted, a date is wrong, a class is misattributed or a link is broken, <a href="https://github.com/DevSecObie/cyberjudah/issues">open an issue</a> on the repository or edit the note directly; the markdown there is the source of record for the site.</p>
        <h2>Building it</h2>
        <p>The notes and the data are committed to <a href="https://github.com/DevSecObie/cyberjudah">DevSecObie/cyberjudah</a>. A content engine turns them into one data set (JSON, a full-text index, SQLite, feeds) on every push, and this site reads that data set. Nothing here is written by hand except the notes themselves.</p>
      </div>
    </Page>
  );
}
