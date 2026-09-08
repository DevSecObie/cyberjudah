# CyberJudah design brief (v2: the terminal)

**Revision note.** v1 invented a lapis/ivory "reading room" identity. The user rejected it: it did not look like CyberJudah, which already has an identity (the half-cyborg lion, `[ cyberjudah ]` in cyan mono with magenta brackets, a near-black HUD with a faint grid). v2 builds on that existing brand and sources its signature components from 21st.dev.

**Design read.** A study library for people who read scripture like engineers read a system: serious, precise, proud of its depth. The register is a terminal session on a dark HUD, the cyber lion of Judah watching from the boot screen. Nothing corporate, nothing soft.

**Concept spine.** *The reading is a terminal session.* Every section is a command and its output: `~/cyberjudah $` prompts as kickers, `//` comments as counts, a `cat bible/psalms/119.txt` typed out before the passage of the day, a search band that is literally a shell prompt. The film is the boot sequence: a dark data hall whose cyan traces light up toward the lion until the session opens on its eyes.

**Delivery tier.** `cinema`: Lenis + GSAP for surrounding motion, the scroll-scrub film as the Tier-1 hero mechanic, a pointer-reactive character field behind the search (21st.dev Cyber Matrix), pointer-tracked glowing borders on the library bento (21st.dev Cybernetic Bento Grid).

**Locked palette (the user's existing brand; overrides the generic ban on near-black + neon).**
- Ground: void `#05070F`. Panels: `#0B1020`, `#101833`. Deep well: `#03050B`. Rules: `#1B2740` / `#2A3A5C`.
- Ink: `#DBE5F0`; display ink `#F2F6FB`; muted `#8298B4`.
- Chrome accent: cyan `#00E5FF` (wordmark, prompts, verse numbers, active states, the one filled CTA, glows).
- Second accent: magenta `#FF2D78` (brackets, the `$` in prompts, the `//` and `>` glyphs, judgment verdicts, the read-link underline). Never a fill.
- Mark: amber `#FCEE0A`, only for the passage reference and "kept the law" verdicts.
- Grid: `rgba(0,229,255,.055)` on a 48 px cell; a faint CRT scanline overlay at 2 percent.

**Locked type.** Chrome, headings, prompts, counts: `JetBrains Mono` 400/500/700. Scripture and note bodies: `Newsreader` (the existing site's serif, so long reads stay comfortable on a dark ground). Both from Google Fonts. Wordmark: `[ cyberjudah ]`, lowercase, 0.14em tracking, cyan with a cyan glow, magenta brackets.

**Animation mode: animated-website**

**Journey shape:** `single-shot`. One continuous 15 second push-in generated with the brand lion as the image reference, cut into four chapter segments at exact frames so the engine scrubs them back to back with no seams.

**Journey (four chapters over the one film):**
1. **The dark hall** (0 to 4 s, wide). A vast data hall, near-black, a distant lion silhouette, one cyan point of light (its eye). Kicker `[ cyberjudah ]`. Headline: "Get wisdom." Tags: 81 books, 36,820 verses. CTA: `$ open the bible`.
2. **Boot sequence** (4 to 8 s). Cyan circuit traces light up along the floor and columns toward the lion; a magenta rim light from the right. Kicker `~/bible $`. Headline: "Read the chapter, and what was taught from it."
3. **The face** (8 to 12 s). The lion resolves: chrome cyan circuitry on the left half, golden mane on the right. Kicker `~/classes $`. Headline: "Four chapters a day. Every Sabbath class. Every episode."
4. **The eyes** (12 to 15 s, close). Eye contact, cyan mechanical eye and amber natural eye, code reflected in the cyan one. Kicker `~/law $`. Headline: "The law, and the record of what came of keeping it."

**World grammar (byte-identical preamble for the film and the cover):** "Vast dark data hall at night, near-black (#05070f), tall server columns and stone pillars with thin glowing cyan (#00e5ff) circuit traces receding into blackness, a faint cyan floor grid, thin haze; the lion from the reference image: left half of the head chrome cybernetic with glowing cyan circuitry and a cyan mechanical eye, right half a natural lion with a golden mane and an amber eye; subject centered, clean negative space left and right, slow steady camera, locked exposure, no motion blur, a touch of magenta (#ff2d78) rim light, no text, no logos, no watermark."

**Mobile framing.** Lion centered; all focal points inside the middle 60 percent of the frame; mobile clips at 720p, centered by the engine.

**Delivery budget.** Desktop segments total under 32 MiB; mobile segments under 16 MiB.

**Section plan (home).**
1. Journey (scroll-scrub, four chapters). Family: full-bleed film with pinned copy alternating left/right.
2. Console. Family: a glass panel over a pointer-reactive field of monospace characters (21st.dev Cyber Matrix Hero, restyled): a titlebar line, `~/cyberjudah$` prompt, the search input, example queries as read-links.
3. HUD strip. Family: four mono counters (verses, notes, laws, cases) that count up on mount.
4. New this week. Family: horizontal snap rail of class and episode cards; the only card rail on the page.
5. The library. Family: asymmetric bento with pointer-tracked glowing borders (21st.dev Cybernetic Bento Grid, restyled): Bible, Sabbath Classes (circuit plate), 4 Chapters a Day, The Captains, Case Studies, The Law, Encyclopedia.
6. Passage of the day. Family: terminal readout over the circuit plate: a typed `cat` command, the passage in Newsreader with the lead in cyan, the reference in amber, a vertical side-rail note (the second-read moment).
7. Footer. Family: four-column link index on the deep well with `~/read`, `~/law`, `~/bin` headers.

Eyebrow budget: ceil(7/3) = 3. Used on sections 4, 5 and 6 (prompt kickers).

**Asset plan.**
- Film: one 15 s 1080p 16:9 seedance_2_5 omni-reference take with the brand lion (`cyber-lion.png`) as the image reference, audio off. Cut into 4 segments; posters from the encoded segments; 720p mobile variants.
- Section plate (1): a dark circuit-board macro with faint cyan traces, used behind the Sabbath Classes cell and the passage readout.
- Logo: the user's existing cyber-lion mark for nav, favicon and head kit.
- Icon set: the v1 line icons recoloured to cyan.
- Cover and OG: composed from a cover scene generated with the lion reference, cutout on the right, cyan frame, per app-cover.md.

**CTA inventory (each its own component).**
- `LampButton` (the one filled control, "exec"): cyan block, mono caps, a `$` glyph before the label, a light bar sweeps across on hover, active scale 0.98.
- `ReadLink` (inline mono link + arrow): cyan text, a magenta underline draws from the left on hover, the arrow steps right.
- `SearchGo` (console submit): cyan magnifier in a bordered square that fills cyan on focus-within of the form.
- `RailCard`: the whole card is the link; hover lifts 3 px, cyan ring, thumbnail brightens.
- `BentoCell`: the whole cell is the link; pointer position drives the spotlight and the masked glowing border ring; title turns cyan.

**Corner language.** 4 px on controls and panels, 6 px on the bento cells (matching the existing site's 4 to 8 px), nothing rounder.

**Anti-convergence ledger.** v1 in this chat was lapis/ivory/vermilion, Outfit, sharp corners, a lamp-lit stone hall. v2 differs on world (data hall, cyber lion), palette (the brand's cyan/magenta on near-black), type (mono + serif), CTA garments (terminal prompts) and corner language (small radii).

**Second-read moment.** The vertical "Passage of the day" side-rail note beside the terminal readout (section 6), placed once.
