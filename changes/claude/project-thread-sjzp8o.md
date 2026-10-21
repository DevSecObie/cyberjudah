# claude/project-thread-sjzp8o

Every IUIC show and series besides the Sabbath classes gets its own section.

## What
- `data/shows.json`: the 43 shows and series found in the transcribed recordings (Patient Saints Radio, The Bible: Book of Our Fathers, Escaping the Plantation 2.0, Armor of God Radio, Hammer Time, Days of Camp, the captains' Giving The Sense From A to Z and History In The AM, and the rest), each with its name as the titles write it, what it is (radio show, TV show, podcast, series) as the recordings say, and the title patterns that file a recording under it. The Truth Shall Make You Free, 15 Minutes w/ The Captains and Our Hidden History keep their own pages.
- `engine/shows.mjs`, `engine/build.mjs`: a class or captains note of one of the shows carries the show's name as its `collection` (read from its title unless the frontmatter names one), and `api/shows/index.json` lists every show with its notes and its count of transcribed recordings.
- Site: `/shows` lists every show and series; `/shows/<slug>` is a show's own section (its notes, browsable like the Truth series), and says plainly when no notes are written yet. "Shows & Series" is in the Teaching menu and the footer, and in the sitemap.
- `/classes` lists only Sabbath classes and `/captains` only 15 Minutes episodes; the shows' notes are in their own sections.
