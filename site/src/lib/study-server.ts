import { generateStudyAnswer, PolicyRefusal, RESERVE_SQL, retrievalTerms, type StudySource } from './study-core';
const json = (body: unknown, status = 200) => Response.json(body, {status, headers:{'Cache-Control':'no-store'}});
async function hash(value: string) {
  const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function studyRequest(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) return json({error:'Please ask from the study assistant page.'},403);
  if (!request.headers.get('content-type')?.includes('application/json')) return json({error:'Expected a question.'},415);
  // Bound the streamed body as well as Content-Length; never trust a supplied length.
  let data: {question?:unknown; previous?:unknown; feed?:unknown};
  try {
    const reader = request.body?.getReader(); if (!reader) throw new Error();
    const decoder = new TextDecoder(); let body = ''; let bytes = 0;
    while (true) { const {done,value} = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > 8192) {await reader.cancel(); throw new Error();} body += decoder.decode(value,{stream:true}); }
    data = JSON.parse(body + decoder.decode());
    if (!data || typeof data !== 'object') throw new Error();
  } catch { return json({error:'Please submit a shorter question.'},400); }
  const question = typeof data.question === 'string' ? data.question.trim() : '';
  const previous = typeof data.previous === 'string' ? data.previous.trim().slice(0,600) : '';
  const feed = ['classes','captains','history'].includes(String(data.feed)) ? String(data.feed) : '';
  if (question.length < 3 || question.length > 600) return json({error:'Use a question between 3 and 600 characters.'},400);
  const terms = retrievalTerms(`${question} ${previous}`);
  if (!terms.length) return json({error:'Include a topic, such as forgiveness, Sabbath, or Isaiah.'},400);
  try {
    const {env} = await import('cloudflare:workers'); const db = env.DB;
    if (!db) throw new Error('Missing index');
    // Fail closed: an owner must verify free-only billing before enabling a provider.
    const geminiEnabled = env.STUDY_GEMINI_FREE_ONLY === 'true' && !!env.GEMINI_API_KEY;
    const cloudflareEnabled = env.STUDY_CLOUDFLARE_FREE_ONLY === 'true' && !!env.AI;
    if (!geminiEnabled && !cloudflareEnabled) return json({error:'Free AI access is being configured. You can use transcript search in the meantime.'},503);
    const now = Math.floor(Date.now()/1000); const day = Math.floor(now/86400); const minute = Math.floor(now/60);
    const reserve = async (bucket: string, limit: number, expires: number) => !!await db.prepare(RESERVE_SQL).bind(bucket,expires,limit).first();
    const ip = await hash(`${day}:${request.headers.get('cf-connecting-ip') || 'unknown'}`);
    if (!await reserve(`minute:${minute}:${ip}`,3,now+120) || !await reserve(`user:${day}:${ip}`,10,(day+1)*86400)) return json({error:'Your study question limit has been reached. Try later, or continue with transcript search.'},429);
    await db.batch([db.prepare('DELETE FROM study_usage WHERE expires < ?').bind(now),db.prepare('DELETE FROM study_cache WHERE expires < ?').bind(now)]);
    const expression = terms.map(t=>`"${t}"`).join(' OR ');
    const result = await db.prepare(`SELECT title,text,video,start,note,feed FROM teaching_passages WHERE teaching_passages MATCH ? AND (? = '' OR feed = ?) ORDER BY bm25(teaching_passages,4,1),rowid LIMIT 18`).bind(expression,feed,feed).all<Omit<StudySource,'id'>>();
    const sources: StudySource[] = []; const videos = new Set<string>();
    for (const row of result.results) {
      if (videos.has(row.video)) continue;
      videos.add(row.video);
      sources.push({...row,id:sources.length+1,title:row.title.slice(0,240),text:row.text.slice(0,2400),start:Math.max(0,Number(row.start)||0),note:row.note?.startsWith('/') && !row.note.startsWith('//') ? row.note : ''});
      if (sources.length === 4) break;
    }
    if (!sources.length) return json({error:'No supporting passages found. Try naming a topic or a scripture.'},404);
    const key = await hash(JSON.stringify(['v1',question,previous,feed,sources]));
    const cached = await db.prepare('SELECT answer FROM study_cache WHERE key = ? AND expires > ?').bind(key,now).first<{answer:string}>();
    if (cached) return json({...JSON.parse(cached.answer),cached:true});
    const answer = await generateStudyAnswer({question,previous,sources,key:geminiEnabled ? env.GEMINI_API_KEY : undefined,
      fallback:cloudflareEnabled ? (model,input)=>env.AI!.run(model,input) : undefined,
      reserve:provider=>reserve(`provider:${day}:${provider}`,provider === 'gemini' ? 100 : 40,(day+1)*86400),
    });
    // Only source-grounded answers, never raw questions or IP addresses, are cached.
    await db.prepare('INSERT OR REPLACE INTO study_cache(key,answer,expires) VALUES(?,?,?)').bind(key,JSON.stringify(answer),now+86400).all();
    return json(answer);
  } catch (error) {
    if (error instanceof PolicyRefusal) return json({error:'The assistant could not answer that question. Try a different study question or use transcript search.'},422);
    return json({error:'The study assistant is temporarily unavailable or its daily allowance is used up. Transcript search is still available.'},503);
  }
}
