import { test } from "node:test";
import assert from "node:assert/strict";
import { figure, findVisuals, placeFrames } from "./frames.mjs";

const board = { ok: true, duration: 9557, levels: [{ level: 2, w: 160, h: 90, frames: 956, rows: 5, cols: 5, sheets: 39, interval: 10 }] };
const ID = "eNMvid6j-qk";
const NOTE = `## Scriptures Opened

**[Deuteronomy 30:11-13](/bible/deuteronomy/30#v11)**  *[[10:37](https://www.youtube.com/watch?v=${ID}&t=637s)]*

> verse

- point one

**[Isaiah 11:10-12](/bible/isaiah/11#v10)**  *[[24:08](https://www.youtube.com/watch?v=${ID}&t=1448s)]*

> verse

- point two
`;

test("cues in the captions become moments, merged when close", () => {
  const v = findVisuals([[10, "Turn to Isaiah."], [695, "Look at this map."], [700, "As you can see."], [1500, "Next slide."]]);
  assert.deepEqual(v, [{ said: 695, t: 700 }, { said: 1500, t: 1505 }]);
});

test("a figure is the sprite cell of the moment, captioned by its time, linked to the recording there", () => {
  const f = figure(ID, board, { said: 695, t: 700 });
  assert.match(f, /frames\/eNMvid6j-qk\/2\/2\.jpg/); // frame 70: sheet 2, row 4, column 0
  assert.match(f, /background-position:0% 100%/);
  assert.match(f, /<span class="shown__at">11:35<\/span>/);
  assert.match(f, /watch\?v=eNMvid6j-qk&t=695s/);
});

test("a moment lands at the end of the scripture block it happened in; earlier ones go under Shown in class", () => {
  const out = placeFrames(NOTE, ID, board, [{ said: 695, t: 700 }, { said: 0, t: 5 }]);
  const deut = out.indexOf("Deuteronomy 30"), fig = out.indexOf('data-t="695"'), isa = out.indexOf("Isaiah 11");
  assert.ok(deut < fig && fig < isa);
  assert.match(out, /## Shown in class\n\n<figure class="shown" data-t="0"/);
  assert.equal(placeFrames(out, ID, board, [{ said: 695, t: 700 }]), out, "already placed: untouched");
  assert.equal(placeFrames(NOTE, ID, board, []), NOTE);
});
