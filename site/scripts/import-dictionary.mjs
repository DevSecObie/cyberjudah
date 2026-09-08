import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Pin the source so subsequent site builds never depend on upstream changes.
const revision = '9fa48b8350242c1b2b99fafa41617bbeb2741fce';
const url = `https://huggingface.co/datasets/JWBickel/BibleDictionaries/resolve/${revision}/Easton%27s%20Bible%20Dictionary.jsonl`;
const response = await fetch(url);
if (!response.ok) throw new Error(`Dictionary download failed: ${response.status}`);
const raw = await response.text();
const seen = new Set();
const entries = raw.split(/\r?\n/).filter(line => line.trim()).map((line, i) => {
  const entry = JSON.parse(line);
  if (typeof entry.term !== 'string' || !entry.term.trim() || !Array.isArray(entry.definitions) || !entry.definitions.length || entry.definitions.some(d => typeof d !== 'string' || !d.trim())) throw new Error(`Invalid entry ${i + 1}`);
  const base = entry.term.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'term';
  let slug = base, n = 2;
  while (seen.has(slug)) slug = `${base}-${n++}`;
  seen.add(slug);
  return { slug, term: entry.term, definitions: entry.definitions };
}).sort((a,b) => a.term.localeCompare(b.term, 'en'));
const output = new URL('../src/data/dictionary/', import.meta.url);
await fs.mkdir(output, { recursive: true });
await fs.writeFile(new URL('easton.json', output), JSON.stringify(entries));
await fs.writeFile(new URL('provenance.json', output), JSON.stringify({ source: "Easton's Bible Dictionary", dataset: 'JWBickel/BibleDictionaries', revision, url, sha256: createHash('sha256').update(raw).digest('hex'), entries: entries.length, transformation: 'Parsed JSONL; preserved term and definition strings; added unique URL slugs and sorted by term.', license: 'Dataset card does not specify a license. Attribution retained; no claim of a new license.' }, null, 2));
console.log(`Imported ${entries.length} Easton entries.`);
