import test from 'node:test';
import assert from 'node:assert/strict';
import { loadClassMetadata } from './class-metadata.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const classes = loadClassMetadata(ROOT);

test('every class credit is a rank and a name, never a caption scrap', () => {
  const bad = [];
  for (const [video, row] of classes) {
    if (!row.teacher) continue;
    for (const who of row.teacher.split('&').map(s => s.trim()))
      if (who !== 'Zakai' && !/^(Bishop|Deacon|Captain|Officer|Elder) [A-Z][\w'-]+$/.test(who)) bad.push(`${video}: ${who}`);
  }
  assert.deepEqual(bad, []);
});

test('classes are credited as their artwork names the teacher', () => {
  const artwork = {
    k68LEa5wIdY: 'Deacon Labachaa',                    // A Soul Without Purpose
    z_QujypG9RI: 'Captain Severus',                    // Making Our Face Harder Than Their Face
    HcXv7k6Zk5k: 'Deacon Malachiyah',                  // The Real Reason Iran Was Attacked
    wr0GsXsLSaM: 'Deacon Eythan & Deacon Malachiyah',  // False New Year: Doctrine Slayer
    gEvcKpqhX1w: 'Captain Immanuel',                   // Fall In Love Again
  };
  for (const [video, who] of Object.entries(artwork)) assert.equal(classes.get(video)?.teacher, who, video);
});
