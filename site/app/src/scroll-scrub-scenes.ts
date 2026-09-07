/**
 * Scene data for the scroll-scrub journey. Single-shot film: one continuous 15 second
 * push-in through a dark data hall to the cyber lion, cut into four segments at exact frames, so the four chapters scrub back to back
 * with no seams. Every poster is the exact first frame of the encoded clip beside it.
 *
 * Kept as a module constant: changing its identity rebuilds the media controller.
 */
import { createElement } from "react";
import type { ScrollScrubScene, ScrollScrubTheme } from "@/components/scroll-scrub/scroll-scrub";
import { LampButton, ReadLink } from "@/components/site/chrome";

export const scrollScrubTheme: ScrollScrubTheme = {
  accent: "#00e5ff",
  background: "#05070f",
  ink: "#f2f6fb",
  muted: "#8298b4",
};

export const scrollScrubScenes: ScrollScrubScene[] = [
  {
    id: "the-hall",
    label: "Begin",
    kicker: "[ cyberjudah ]",
    title: "Get wisdom.",
    body: "Every verse of the King James text with the Apocrypha, and everything taught from it, on the same page.",
    tags: ["81 books", "36,820 verses"],
    actions: createElement(LampButton, { to: "/bible", children: "Open the Bible" }),
    clip: "/assets/world/scene-01.mp4",
    poster: "/assets/world/scene-01-poster.png",
    mobileClip: "/assets/world/scene-01-mobile.mp4",
    mobilePoster: "/assets/world/scene-01-mobile-poster.png",
    align: "left",
    scroll: 1.6,
  },
  {
    id: "the-lamp",
    label: "The chapter",
    kicker: "~/bible $",
    title: "Read the chapter, and what was taught from it.",
    body: "Each chapter carries the class notes, laws, precepts, and cases that cite it, so a passage and its teaching sit together.",
    tags: ["1,009 chapters taught"],
    actions: createElement(ReadLink, { to: "/bible/genesis/1", children: "Start at Genesis 1" }),
    clip: "/assets/world/scene-02.mp4",
    poster: "/assets/world/scene-02-poster.png",
    mobileClip: "/assets/world/scene-02-mobile.mp4",
    mobilePoster: "/assets/world/scene-02-mobile-poster.png",
    align: "right",
    scroll: 1.4,
  },
  {
    id: "the-face",
    label: "The classes",
    kicker: "~/classes $",
    title: "Four chapters a day. Every Sabbath class. Every episode.",
    body: "Written up in full, in the teacher's own words, with every scripture quoted where it was read.",
    tags: ["Sabbath classes", "15 Minutes w/ The Captains"],
    actions: createElement(ReadLink, { to: "/classes", children: "Browse the classes" }),
    clip: "/assets/world/scene-03.mp4",
    poster: "/assets/world/scene-03-poster.png",
    mobileClip: "/assets/world/scene-03-mobile.mp4",
    mobilePoster: "/assets/world/scene-03-mobile-poster.png",
    align: "left",
    scroll: 1.4,
  },
  {
    id: "the-eyes",
    label: "The law",
    kicker: "~/law $",
    title: "The law, and the record of what came of keeping it.",
    body: "A handbook of 1,562 laws, 445 precepts, and 269 cases: the judgments, and those who kept the law and were blessed.",
    actions: createElement(ReadLink, { to: "/cases", children: "Read the cases" }),
    clip: "/assets/world/scene-04.mp4",
    poster: "/assets/world/scene-04-poster.png",
    mobileClip: "/assets/world/scene-04-mobile.mp4",
    mobilePoster: "/assets/world/scene-04-mobile-poster.png",
    align: "right",
    scroll: 1.5,
    linger: 0.25,
  },
];
