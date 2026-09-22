import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Page } from '@/components/site/chrome';
import { pageHead } from '@/lib/head';
import type { StudyAnswer } from '@/lib/study-core';
export const Route = createFileRoute('/assistant')({head:({match})=>pageHead([{title:'AI Study Assistant · CyberJudah'}],match),component:StudyAssistant});
const time = (n:number) => {n=Math.floor(n);return `${n>=3600 ? `${Math.floor(n/3600)}:` : ''}${n>=3600 ? String(Math.floor(n/60)%60).padStart(2,'0') : Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;};
type Turn = {question:string;result:StudyAnswer};
function StudyAssistant() {
  const [question,setQuestion]=useState(''); const [feed,setFeed]=useState('');
  const [turns,setTurns]=useState<Turn[]>([]); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  async function ask() {
    if(busy || !question.trim())return;
    const asked=question.trim();setBusy(true);setError('');
    try {
      const response=await fetch('/study-answer',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(65000),body:JSON.stringify({question:asked,feed,previous:turns.at(-1)?.question || ''})});
      const result=await response.json() as StudyAnswer & {error?:string};
      if(!response.ok || result.error)throw new Error(result.error || 'Unable to answer right now.');
      setTurns(old=>[...old,{question:asked,result}]);setQuestion('');
    }catch(e){setError(e instanceof Error && e.name !== 'TimeoutError' ? e.message : 'The answer took too long. Please try again shortly.');}
    finally{setBusy(false);}
  }
  return <Page>
    <p className="cj-kicker">Study with the teaching library</p><h1 className="cj-h1">Ask. Read. Verify.</h1>
    <p className="cj-lede">Ask a question across the classes. Explore an answer with the transcript passages and recordings beside it.</p>
    <p style={{margin:'1rem 0'}}>AI can make mistakes. Check the cited passages and scripture. Questions and relevant excerpts are sent to Google or Cloudflare; Google’s free tier may use them to improve its products. Avoid sharing private information.</p>
    <div style={{display:'flex',gap:'1rem',flexWrap:'wrap',margin:'1.5rem 0'}}><Link to="/teachings" search={{q:'',feed:'',page:1}}>Search transcripts →</Link>{turns.length>0 && <button type="button" disabled={busy} onClick={()=>{setTurns([]);setError('');setQuestion('');}}>Start a new topic</button>}</div>
    {!turns.length && <div style={{display:'flex',gap:'.75rem',flexWrap:'wrap',margin:'1rem 0'}}>{['What do these teachings say about forgiveness?','Summarize the teachings about the Sabbath.','Give me five review questions about repentance.'].map(q=><button key={q} type="button" disabled={busy} onClick={()=>setQuestion(q)} style={{padding:'.8rem',border:'1px solid var(--color-muted)',textAlign:'left'}}>{q}</button>)}</div>}
    <div aria-live="polite" aria-busy={busy}>{turns.map(({question:asked,result},index)=><article key={index} style={{margin:'2rem 0',padding:'1.5rem 0',borderTop:'1px solid var(--color-muted)'}}>
      <p className="cj-kicker">Your question</p><h2 style={{fontSize:'1.5rem',margin:'.5rem 0 1rem'}}>{asked}</h2><p className="cj-mono">{result.provider}{result.cached ? ' · Previously generated answer' : ''}</p>
      <div style={{whiteSpace:'pre-wrap',lineHeight:1.8,margin:'1rem 0'}}>{result.answer.split(/(\[\d+\])/g).map((part,i)=>{const match=part.match(/^\[(\d+)\]$/);return match ? <a key={i} href={`#source-${index}-${match[1]}`} aria-label={`Read source ${match[1]}`} style={{fontWeight:700,textDecoration:'underline'}}>{part}</a> : part;})}</div>
      <h3 style={{fontSize:'1.25rem',marginTop:'1.5rem'}}>Supporting passages</h3>
      {result.sources.map(source=><details key={source.id} id={`source-${index}-${source.id}`} style={{padding:'1rem 0',borderBottom:'1px solid var(--color-muted)',scrollMarginTop:'6rem'}}>
        <summary style={{cursor:'pointer'}}><b>[{source.id}] {source.title}</b> · {time(source.start)}</summary><p style={{whiteSpace:'pre-wrap',lineHeight:1.7,margin:'1rem 0'}}>{source.text}</p>
        <div style={{display:'flex',gap:'1rem',flexWrap:'wrap'}}><a href={`https://www.youtube.com/watch?v=${encodeURIComponent(source.video)}&t=${Math.floor(source.start)}s`} target="_blank" rel="noreferrer">Watch passage from {time(source.start)} ↗</a>{source.note && <a href={source.note}>Read class notes →</a>}</div>
      </details>)}
    </article>)}</div>
    <form onSubmit={e=>{e.preventDefault();void ask();}} style={{margin:'2rem 0'}}>
      <label htmlFor="study-question" style={{display:'block',fontWeight:700,marginBottom:'.75rem'}}>{turns.length ? 'Ask a follow-up question' : 'What would you like to study?'}</label>
      <textarea id="study-question" value={question} onChange={e=>setQuestion(e.target.value)} maxLength={600} minLength={3} required disabled={busy} rows={3} placeholder="Ask about a topic, a scripture, or a teaching…" style={{width:'100%',padding:'1rem',color:'inherit',background:'var(--color-bg)',border:'1px solid var(--color-muted)',borderRadius:4}}/>
      <div style={{display:'flex',gap:'1rem',alignItems:'center',flexWrap:'wrap',marginTop:'1rem'}}><label>Collection <select value={feed} disabled={busy} onChange={e=>{setFeed(e.target.value);setTurns([]);setError('');}} style={{padding:'.6rem',color:'inherit',background:'var(--color-bg)'}}><option value="">All collections</option><option value="classes">Classes</option><option value="captains">Captains</option><option value="history">Our Hidden History</option></select></label><button className="search-go" style={{width:"auto",padding:".8rem 1.2rem",border:"1px solid var(--color-cyan)",borderRadius:4,minHeight:44,opacity:busy || question.trim().length<3 ? .55 : 1}} disabled={busy || question.trim().length<3} type="submit">{busy ? 'Reading passages…' : 'Ask the study assistant'}</button></div>
      {turns.length>0 && <p style={{marginTop:'.75rem'}}>Uses your previous question for topic context. Start a new topic to clear it.</p>}
      <p style={{marginTop:'.75rem',color:'var(--color-muted)'}}>Up to 10 questions per day per connection, subject to the site’s daily allowance. Your conversation stays in this tab.</p>
      {busy && <p role="status" style={{marginTop:'1rem'}}>Finding supporting passages and preparing your answer…</p>}{error && <p role="alert" style={{marginTop:'1rem'}}>{error} <Link to="/teachings" search={{q:question.slice(0,200),feed,page:1}}>Search transcripts →</Link></p>}
    </form>
  </Page>;
}
