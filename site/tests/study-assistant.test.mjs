import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
const source=readFileSync(new URL('../src/lib/study-core.ts',import.meta.url),'utf8');
const module=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {generateStudyAnswer,validateAnswer,retrievalTerms,RESERVE_SQL,PolicyRefusal}=await import(`data:text/javascript;base64,${Buffer.from(module).toString('base64')}`);
const sources=[{id:1,title:'Forgiveness',text:'Forgive one another.',video:'test',start:90,note:'',feed:'classes'}];
const options={question:'What is forgiveness?',previous:'',sources,key:'test-key',reserve:async()=>true};
const good=()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'Forgive one another. [1]'}]}}]});
test('Gemini answers use retrieved sources and do not call fallback',async()=>{
  let called=false;
  const answer=await generateStudyAnswer({...options,fetcher:async(_url,init)=>{const body=JSON.parse(init.body);assert.match(body.contents[0].parts[0].text,/Forgive one another/);assert.equal(init.headers['x-goog-api-key'],'test-key');return good();},fallback:async()=>{called=true;}});
  assert.equal(answer.provider,'Gemini');assert.equal(called,false);
});
for(const status of [429,500,503])test(`Gemini ${status} falls back once`,async()=>{
  const calls=[];const answer=await generateStudyAnswer({...options,reserve:async p=>{calls.push(p);return true;},fetcher:async()=>new Response('',{status}),fallback:async()=>({response:'Study forgiveness. [1]'})});
  assert.equal(answer.provider,'Cloudflare AI');assert.deepEqual(calls,['gemini','cloudflare']);
});
test('timeouts and missing Gemini key use fallback',async()=>{
  for(const extra of [{fetcher:async()=>{throw new DOMException('Timed out','TimeoutError');}},{key:undefined}]){
    const answer=await generateStudyAnswer({...options,...extra,fallback:async()=>({choices:[{finish_reason:'stop',message:{content:'Forgive. [1]'}}]})});assert.equal(answer.provider,'Cloudflare AI');
  }
});
test('provider budgets prevent both calls',async()=>{
  let called=false;await assert.rejects(()=>generateStudyAnswer({...options,reserve:async()=>false,fetcher:async()=>{called=true;return good();},fallback:async()=>{called=true;}}));assert.equal(called,false);
});
test('policy refusals do not trigger fallback',async()=>{
  let called=false;await assert.rejects(()=>generateStudyAnswer({...options,fetcher:async()=>Response.json({candidates:[{finishReason:'SAFETY'}]}),fallback:async()=>{called=true;}}),PolicyRefusal);assert.equal(called,false);
});
test('unknown or absent citations are rejected and reasoning is stripped',()=>{
  assert.throws(()=>validateAnswer('An invented answer. [99]',sources));assert.throws(()=>validateAnswer('Uncited answer',sources));
  assert.equal(validateAnswer('<think>private reasoning</think>Answer. [1]',sources),'Answer. [1]');
});
test('truncated provider output is rejected',async()=>{
  await assert.rejects(()=>generateStudyAnswer({...options,key:undefined,fallback:async()=>({choices:[{finish_reason:'length',message:{content:'Partial. [1]'}}]})}));
});
test('usage reservations atomically stop at quota and migration preserves corpus',()=>{
  const db=new DatabaseSync(':memory:');db.exec("CREATE TABLE teaching_passages(text); INSERT INTO teaching_passages VALUES('preserved')");
  const migration=readFileSync(new URL('../migrations/0001-study-assistant.sql',import.meta.url),'utf8');db.exec(migration);db.exec(migration);
  const reserve=db.prepare(RESERVE_SQL);for(let i=0;i<40;i++)assert.ok(reserve.get('provider:today:cloudflare',100,40));
  for(let i=0;i<10;i++)assert.equal(reserve.get('provider:today:cloudflare',100,40),undefined);
  assert.equal(db.prepare('SELECT used FROM study_usage').get().used,40);assert.equal(db.prepare('SELECT text FROM teaching_passages').get().text,'preserved');db.close();
});
test('natural language retrieval removes question boilerplate',()=>{
  assert.deepEqual(retrievalTerms('What do these teachings say about forgiveness?'),['forgiveness']);
  assert.deepEqual(retrievalTerms('Summarize the teachings about the Sabbath.'),['sabbath']);
});

const {runInNewContext}=await import('node:vm');
const {webcrypto}=await import('node:crypto');
const serverSource=readFileSync(new URL('../src/lib/study-server.ts',import.meta.url),'utf8');
function serverWith(env){
  const exports={};
  const core={generateStudyAnswer,PolicyRefusal,RESERVE_SQL,retrievalTerms};
  runInNewContext(ts.transpileModule(serverSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>name==='cloudflare:workers'?{env}:core,Response,TextDecoder,TextEncoder,URL,crypto:webcrypto,console});
  return exports.studyRequest;
}
const req=(body,origin='https://cyberjudah.io')=>new Request('https://cyberjudah.io/study-answer',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('no billing attestations means zero provider or database operations',async()=>{
  let calls=0;const handler=serverWith({DB:{prepare:()=>{calls++;throw new Error();}},GEMINI_API_KEY:'unused',AI:{run:()=>{calls++;}}});
  const result=await handler(req({question:'What is forgiveness?'}));assert.equal(result.status,503);assert.match((await result.json()).error,/Free AI access/);assert.equal(calls,0);
});
test('request rejects cross-origin, oversized and malformed input before provider access',async()=>{
  const handler=serverWith({});
  assert.equal((await handler(req({question:'What is forgiveness?'},'https://other.example'))).status,403);
  assert.equal((await handler(req({question:'x'.repeat(9000)}))).status,400);
  assert.equal((await handler(req({question:12}))).status,400);
  assert.equal((await handler(req(null))).status,400);
});
