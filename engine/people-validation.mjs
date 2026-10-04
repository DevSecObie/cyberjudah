import legacy from './people-legacy-links.json' with {type:'json'};
const kinds=['father','mother','siblings','partners','children'];
const accepted=new Set(legacy.unresolved);
export function validatePeople(doc){
  const problems=[],people=doc.people;
  if(!Array.isArray(people))return ['People must be a list'];
  const byId=new Map(people.map(p=>[p.id,p]));
  if(byId.size!==people.length)problems.push('A person id is repeated');
  for(const p of people){
    if(!/^[a-z0-9][a-z0-9-]{0,119}$/.test(p.id)||typeof p.description!=='string')problems.push(`${p.id}: invalid id or summary`);
    for(const kind of kinds){
      if(!Array.isArray(p[kind])){problems.push(`${p.id}: ${kind} must be a list`);continue;}
      if(new Set(p[kind]).size!==p[kind].length)problems.push(`${p.id}: repeated ${kind}`);
      for(const id of p[kind])if(id===p.id||!byId.has(id)&&!accepted.has(`${p.id}|${kind}|${id}`))problems.push(`${p.id}: ${kind} must name another catalog person`);
    }
    if(p.image){
      const i=p.image;
      for(const k of ['src','sourceUrl'])try{if(new URL(i[k]).protocol!=='https:')throw new Error();}catch{problems.push(`${p.id}: image ${k} must be HTTPS`);}
      for(const k of ['caption','credit','license'])if(typeof i[k]!=='string'||!i[k].trim())problems.push(`${p.id}: image needs ${k}`);
    }
  }
  return problems;
}
/** Deliberately copy only credited picture metadata into the reader's existing profile. */
export function personPicture(person){return person.image?{image:person.image}:{};}
