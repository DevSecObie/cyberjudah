// Two-way relationships for People, enforced on what a change actually touches: every
// Apocrypha batch (CYB-145) adds or patches identities straight into data/people/people.json,
// each with every father/mother/sibling/partner/child link the text states, in both
// directions (the owner's correction, 6 October 2026). Checking the whole 3,000+ person TIPNR
// catalog for reciprocity would fail CI on legacy data no one asked this batch to fix; checking
// only the ids a change adds or edits (via a base commit, as check-cms.mjs already does for
// Timeline events) keeps the gate real without that noise.
const KINDS = ['father', 'mother', 'siblings', 'partners', 'children'];
// A -> B by one of these kinds implies B -> A by one of the kinds it is paired with.
const RECIPROCALS = { father: ['children'], mother: ['children'], children: ['father', 'mother'], siblings: ['siblings'], partners: ['partners'] };

/** Ids whose record differs (or is new) between two { people: [...] } catalogs. */
export function changedPersonIds(beforeDoc, afterDoc) {
  const before = new Map((beforeDoc?.people ?? []).map((p) => [p.id, p]));
  const ids = [];
  for (const p of afterDoc.people) if (JSON.stringify(p) !== JSON.stringify(before.get(p.id))) ids.push(p.id);
  return ids;
}

/** Every relation edge a changed id carries must read back from the other side too (a child's
 * father lists the child; the father's children lists the child back), whether the other side
 * is itself changed or was already in the catalog. A documented, reasoned exception goes in
 * `exceptions` as "id|kind|otherId"; nothing is invented to satisfy this. */
export function validateReciprocity(peopleDoc, ids, exceptions = []) {
  const problems = [];
  const byId = new Map(peopleDoc.people.map((p) => [p.id, p]));
  const except = new Set(exceptions);
  for (const id of ids) {
    const person = byId.get(id);
    if (!person) continue; // deleted, or not in this catalog: nothing to check reciprocity against
    for (const kind of KINDS) {
      for (const otherId of person[kind] ?? []) {
        const other = byId.get(otherId);
        if (!other) continue; // validatePeople already reports a missing id
        const ok = RECIPROCALS[kind].some((back) => (other[back] ?? []).includes(id));
        if (!ok && !except.has(`${id}|${kind}|${otherId}`)) {
          problems.push(`${id}: ${kind} names ${otherId}, but ${otherId} does not name ${id} back (${RECIPROCALS[kind].join(' or ')})`);
        }
      }
    }
  }
  return problems;
}
