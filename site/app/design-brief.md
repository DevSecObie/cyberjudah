# CyberJudah design brief

**Design read.** A study library for people who read scripture with a pen in hand: serious, unhurried, and proud of its depth. The register is a great reading room after hours, one lamp lit, the lion of Judah keeping watch. Nothing corporate, nothing "AI dark SaaS".

**Concept spine.** *Stage / spotlight, read as "a lamp unto my feet".* Light travels through darkness and reveals the library one room at a time. The film is a single push-in through a dark lapis hall toward a lion lit by one ivory lamp; every section after it is another surface the same light lands on. The whole page is one lamp moving through one house.

**Delivery tier.** `cinema`: Lenis + GSAP for surrounding motion, the scroll-scrub film as the Tier-1 hero mechanic, scroll chapters, hover reveals on the library rail.

**Locked palette.**
- Ground: lapis `#0F1F5A` (deep blue field, not a graphite ground). Surfaces: `#16297A` and `#1D3492`. Deep well: `#09143D`.
- Ink: ivory `#F3EEDF`. Muted ink: `#B7C0DC`.
- Accent (the one accent): lamp vermilion `#E4572E`. Used for the lamp, the primary CTA block, the active chapter mark, and nothing else.
- Defense: the current CyberJudah brand is near-black + neon cyan/magenta, which is on the banned list, and the user chose a new identity. Lapis is the pigment of the tabernacle's blue and the ground colour of illuminated manuscripts; ivory is the page; vermilion is the lamp flame. Blue field + warm flame is a Bold Studio Solid palette, not a graphite + ember one.

**Locked type.** Display: `Outfit` (geometric, expressive at 700, tight tracking). Text and UI: `Outfit` 400/500. Mono: `IBM Plex Mono` for references, counts, and the chapter route. Both from Google Fonts (permitted by the CSP). No serif: the library reads as a modern instrument for an old text, and the scripture itself is set in Outfit at a generous measure.

**Animation mode: animated-website**

**Journey shape:** `single-shot`. One continuous 15 second push-in, generated in one call, then cut into four chapter segments at exact frames so the engine scrubs them back to back with no seams (every segment boundary is the same frame on both sides).

**Journey (four chapters over the one film):**
1. **The dark hall** (0 to 4 s, wide). Focal point: a faint lion silhouette far down a dark lapis hall, one small lamp. Headline: "Get wisdom." Sentence: "Every verse of the King James text with the Apocrypha, and everything taught from it, on the same page." Tags: 81 books, 36,820 verses.
2. **The lamp rises** (4 to 8 s). Focal point: the lamp light climbs the stone steps, the lion's shape resolves. Headline: "Read the chapter, and what was taught from it." Sentence: "Each chapter carries the class notes, laws, precepts, and cases that cite it." Tags: 1,009 chapters taught.
3. **The face** (8 to 12 s). Focal point: the lion's head lit from the side, mane catching the ivory light. Headline: "Four chapters a day, every Sabbath class, every episode." Sentence: "Written up in full, in the teacher's own words, with every scripture quoted where it was read." Tags: 98 classes, 6 episodes.
4. **The eyes** (12 to 15 s, close). Focal point: eye contact, the lamp flame reflected in the lion's eye. Headline: "The law, and the record of what came of keeping it." Sentence: "A handbook of 1,562 laws, 445 precepts, and 269 cases: judgments, and those who kept the law and were blessed." Tags: none.

**World grammar (byte-identical preamble for every film and board prompt):** "Cinematic still, dark lapis blue chamber (#0F1F5A) with smooth stone floor and tall unlit stone columns receding into blackness, a single warm ivory lamp (#F3EEDF light with a vermilion #E4572E flame) as the only light source, a regal African lion standing centered on a low stone step, subject center-safe with clean negative space left and right, slow steady camera, locked exposure, no motion blur, no text, no logos, no watermark."

**Mobile framing.** Lion centered; all focal points inside the middle 60 percent of the frame; mobile clips capped at 720p and cropped to the centre by the engine's object-position 50% 50%.

**Delivery budget.** Desktop segments total ≤ 32 MiB; mobile segments total ≤ 16 MiB.

**Section plan (home).**
1. Journey (scroll-scrub, four chapters). Family: full-bleed film with pinned copy, copy alternating left/right.
2. Search band. Family: single oversized input on a solid lapis surface, left-anchored, with example queries as inline links. One CTA: the search itself.
3. New this week. Family: horizontal rail of class and episode cards (thumbnail, title, teacher, date), snap scrolling, no cards elsewhere on the page.
4. The library. Family: asymmetric bento with six cells of real counts (Bible, 4 Chapters a Day, Sabbath Classes, The Captains, Encyclopedia, The Law); two cells carry a section plate image, the rest are flat lapis tints.
5. Passage of the day. Family: full-width statement with a narrow vertical side-rail note (the second-read moment): the reference in mono, a "read the chapter" inline link.
6. Footer. Family: three-column link index on the deep well, ivory rules.

Eyebrow budget: ceil(6/3) = 2. Used on sections 3 and 5 only.

**Asset plan.**
- Storyboard: one 16:9 six-panel grid of the single continuous push-in (pins look, grade, lens).
- Film: one 15 s 1080p 16:9 seedance_2_5 take, storyboard as image reference, audio off. Cut into 4 segments; posters from the encoded segments.
- Section plates (2): a lapis stone-and-lamplight texture for the library bento; a close macro of ivory paper grain under lamplight for the passage band.
- Custom icon set: one sheet of 8 glyphs (open book, lamp, scroll, gavel, lion head, magnifier, calendar page, speaker) in 2 px ivory stroke on lapis, sliced and background-removed.
- Logo / monogram: a lion head in profile inside a square, single ivory line weight, for nav and head kit (favicon, apple touch, 192/512, maskable).
- OG card: composed from the cover scene per app-cover.md; separate OG for the reader route later.

**CTA inventory (each its own component).**
- `LampButton` (primary, once in the journey chapter 1 and once in the library): vermilion filled rectangle, sharp corners, ivory label, on hover the fill "lights" from the left edge (transform-only scale of an inner layer), active scale 0.98.
- `ReadLink` (inline underlined link + arrow, used in chapters 2 to 4, the passage band, and the rail): ivory text with a 1 px ivory underline that draws from the left on hover.
- `SearchGo` (the search band's submit): an ivory-outlined square with the magnifier icon, fills ivory with lapis glyph on focus-within of the form.
- `RailCard` (the New this week cards): the whole card is the link; hover lifts 2 px and brightens the thumbnail.

**Corner language.** All sharp. No radius anywhere except the search input caret.

**Anti-convergence ledger.** No previous build in this chat. Not applicable.

**Second-read moment.** The narrow vertical side-rail note beside the passage of the day (section 5), placed once.
