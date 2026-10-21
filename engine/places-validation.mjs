// The places of the Bible (data/places/places.json, from STEPBible's TIPNR): each with an id, a
// name, its verses as "slug/chapter/verse", and map coordinates only where they are known.
const VERSE = /^[a-z0-9-]+\/\d+\/\d+$/;
export function validatePlaces(doc){
  const problems=[],places=doc.places;
  if(!Array.isArray(places))return ['Places must be a list'];
  if(new Set(places.map(p=>p.id)).size!==places.length)problems.push('A place id is repeated');
  for(const p of places){
    if(!/^[a-z0-9][a-z0-9-]{0,119}$/.test(p.id)||typeof p.name!=='string'||!p.name.trim())problems.push(`${p.id}: invalid id or name`);
    if(!Array.isArray(p.names)||!p.names.includes(p.name))problems.push(`${p.id}: names must include the name`);
    if(!Array.isArray(p.verses)||!p.verses.length||!p.verses.every(v=>VERSE.test(v)))problems.push(`${p.id}: verses must be "slug/chapter/verse"`);
    if(p.coords!==null&&!(Array.isArray(p.coords)&&p.coords.length===2&&p.coords.every(Number.isFinite)&&Math.abs(p.coords[0])<=90&&Math.abs(p.coords[1])<=180))problems.push(`${p.id}: coords must be [lat, lng] or null`);
    if(!Array.isArray(p.strongs)||!p.strongs.every(s=>/^[GH]\d+[A-Za-z]?$/.test(s)))problems.push(`${p.id}: invalid Strong's numbers`);
  }
  return problems;
}
