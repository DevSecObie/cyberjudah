import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadShows, parseShows, showOf } from "../../engine/shows.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const shows = loadShows(ROOT);
const of = (title) => showOf(shows, title)?.name ?? null;

test("a recording is filed under the show its title names, whatever tags lead it", () => {
  assert.equal(of("#IUIC | PATIENT SAINTS RADIO: June 26, 2022"), "Patient Saints Radio");
  assert.equal(of("Patient Saints: May 16, 2021"), "Patient Saints Radio");
  assert.equal(of("AOG | Faith Under Fire"), "Armor of God Radio");
  assert.equal(of("#IUIC || Giving The Sense From A to Z || Isaiah Chapter 53"), "Giving The Sense From A to Z");
  assert.equal(of("Giving the Sense | Luke 13:1 -"), "Giving The Sense From A to Z");
  assert.equal(of("Stop Hating On God’s Greatness!! || Mic’d Up: The Avengers Podcast"), "Mic'd Up: The Avengers Podcast");
  assert.equal(of("#IUIC | 45 Days of Camp | Day 43 Speaking Straight Facts To The Diaspora"), "Days of Camp");
  assert.equal(of("IUIC | TopAfric Radio | #ABORTION"), "TopAfric Radio");
  assert.equal(of("Book of Our Fathers: Who’s Who Part 3"), "The Bible: Book of Our Fathers");
});

test("the more specific show wins where two names share a start", () => {
  assert.equal(of("#IUIC | THE POWER HOUR PLUS: The Bible is Truer than True!"), "The Power Hour Plus");
  assert.equal(of("IUIC | The Power Hour: Mexico Border Crisis"), "The Power Hour");
  assert.equal(of("ESCP 2.0 | The Scapegoat And The Return Of The Red Summer"), "Escaping the Plantation 2.0");
  assert.equal(of("ESCP | Lord Of The House: The Restoration Of The Israelite Man"), "Escaping the Plantation");
});

test("a Sabbath class or a 15 Minutes episode is in no show", () => {
  assert.equal(of("The Israelites: Destroy & Rebuild"), null);
  assert.equal(of("Daily Bread for a Dying Man"), null);
  assert.equal(of("Honor Thy Father & Thy Mother || 15 Minutes W/ The Captains"), null);
});

test("every show has a unique slug, a name and what it is", () => {
  assert.ok(shows.length > 30);
  for (const s of shows) assert.ok(s.kind && !/sabbath/i.test(s.kind), s.slug);
  assert.throws(() => parseShows({ shows: [{ slug: "a", name: "A", kind: "Show" }, { slug: "a", name: "B", kind: "Show" }] }));
  assert.throws(() => parseShows({ shows: [{ slug: "a", name: "A" }] }));
});
