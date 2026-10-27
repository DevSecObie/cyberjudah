import fs from 'node:fs';
import path from 'node:path';

// Checks the People catalog rebuilt from the KJV (data/people-kjv/<book>.json, built by
// scripts/people-kjv/build.py). Every verse a person cites must name them; every family
// link must point at a person, carry an evidence label and cite verses that exist; and
// links that run both ways (children and parents, husbands and wives, brothers and
// sisters, possible same person) must be recorded on both people.
export const EVIDENCE = {
  scripture: 'Scripturally confirmed',
  parallel: 'Parallel identification',
  history: 'Historically identified',
  variant: 'Textual variant',
  uncertain: 'Identity uncertain',
};
const LINKS = ['father', 'mother', 'partners', 'siblings', 'children', 'line', 'nation', 'same'];
const TYPES = new Set(['Male', 'Female', 'Unknown', 'Group', 'Creature']);
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const namePattern = (form) => new RegExp(`\\b${form.split(/[-–\s]+/).filter(Boolean).map(escapeRegExp).join('[-–\\s]?')}\\b`);

function verseText(ref, bibleDir, cache) {
  const m = /^([a-z0-9-]+)\/(\d+)\/(\d+)$/.exec(ref);
  if (!m) return null;
  if (!cache.has(m[1])) {
    try { cache.set(m[1], JSON.parse(fs.readFileSync(path.join(bibleDir, `${m[1]}.json`), 'utf8')).chapters); }
    catch { cache.set(m[1], null); }
  }
  const text = cache.get(m[1])?.[m[2]]?.[Number(m[3]) - 1];
  return typeof text === 'string' ? text : null;
}

/** Every data/people-kjv/*.json file, as one list of people. */
export function loadKjvPeople(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
    .flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).people);
}

export function validateKjvPeople(people, { bibleDir }) {
  const problems = [];
  const cache = new Map();
  const byId = new Map();
  for (const p of people) {
    if (byId.has(p.id)) problems.push(`people-kjv: ${p.id} appears twice`);
    byId.set(p.id, p);
  }
  for (const p of people) {
    const where = `people-kjv: ${p.id}`;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.id ?? '')) problems.push(`${where}: bad id`);
    if (!p.name || !Array.isArray(p.names) || !p.names.includes(p.name)) problems.push(`${where}: name must be one of names`);
    if (!TYPES.has(p.type)) problems.push(`${where}: type ${p.type}`);
    if (!p.description) problems.push(`${where}: no description`);
    if (!p.verses?.length) problems.push(`${where}: no verses`);
    const patterns = (p.names ?? []).map(namePattern);
    for (const ref of p.verses ?? []) {
      const text = verseText(ref, bibleDir, cache);
      if (text === null) problems.push(`${where}: ${ref} is not a verse`);
      else if (!patterns.some((re) => re.test(text))) problems.push(`${where}: ${ref} does not name ${p.names.join(' or ')}`);
    }
    for (const field of LINKS) {
      for (const e of p[field] ?? []) {
        const at = `${where} ${field} ${e.id}`;
        if (!byId.has(e.id)) { problems.push(`${at}: no such person`); continue; }
        if (e.id === p.id) problems.push(`${at}: links to itself`);
        if (!EVIDENCE[e.evidence]) problems.push(`${at}: evidence ${e.evidence}`);
        if (!e.verses?.length) problems.push(`${at}: no verses`);
        for (const ref of e.verses ?? []) if (verseText(ref, bibleDir, cache) === null) problems.push(`${at}: ${ref} is not a verse`);
        if (e.evidence === 'uncertain' && !e.note) problems.push(`${at}: an uncertain link needs a note`);
        const q = byId.get(e.id);
        const back = { father: ['children'], mother: ['children'], children: ['father', 'mother'], partners: ['partners'], siblings: ['siblings'], same: ['same'] }[field];
        if (back && !back.some((f) => (q[f] ?? []).some((x) => x.id === p.id))) problems.push(`${at}: not recorded back on ${e.id}`);
        if (field === 'father' && !['Male', 'Unknown'].includes(q.type)) problems.push(`${at}: father is ${q.type}`);
        if (field === 'mother' && !['Female', 'Unknown'].includes(q.type)) problems.push(`${at}: mother is ${q.type}`);
        if (field === 'nation' && q.type !== 'Group') problems.push(`${at}: not a people`);
      }
    }
  }
  return problems;
}
