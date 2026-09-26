import test from 'node:test';
import assert from 'node:assert/strict';
import {callOpenAI,validateReport,evidenceCatalog,canonicalPacket} from '../scripts/incident-report.mjs';
import {readFile} from 'node:fs/promises';
import {createService} from '../dist/js/service.js';
import {createClueService} from '../dist/js/clue-service.js';

const report={title:'A scoped investigation',summary:'Two observation groups differ within the same recorded window.',findings:[{title:'Timing differs by observed group',observation:'Four clients repeat while peers do not.',reasoning:'A shared interface count can conceal client concentration.',alternative:'Unequal observation time could explain part of the contrast.',nextCheck:'Compare session logs and exposure time for both groups.',confidence:'Tentative relationship',evidenceIds:['cohort-test']}],limitations:['No application outcome is measured.']};
const packet={analysisFacts:[{id:'cohort-test',values:{count:4}}],scope:{},window:{},aggregateValues:{globalSummary:{}},coverage:{},limitations:[]};
const success=()=>new Response(JSON.stringify({status:'completed',id:'mock',model:'test-model',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(report)}]}]}));

test('OpenAI receives a strict schema and isolated context; credential stays in authorization only',async()=>{
  const result=await callOpenAI({key:'test-only-secret',model:'test-model',packet,engineerContext:'An unverified note',fetcher:async(url,options)=>{
    assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.headers.Authorization,'Bearer test-only-secret');
    assert.ok(!options.body.includes('test-only-secret'));const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.text.format.strict,true);
    const input=JSON.parse(body.input);assert.equal(input.engineerContext.attribution,'Unverified engineer-supplied context');assert.deepEqual(input.evidence,packet);return success();
  }});
  assert.deepEqual(result.report,report);
});
test('Fabricated fact references and overlong one-page reports are rejected',()=>{
  assert.throws(()=>validateReport({...report,findings:[{...report.findings[0],evidenceIds:['invented']}]},['cohort-test']),{code:'invalid_report'});
  const long=structuredClone(report);long.findings=Array.from({length:3},()=>({...report.findings[0],observation:'a '.repeat(170),reasoning:'a '.repeat(160),alternative:'a '.repeat(100),nextCheck:'a '.repeat(100)}));
  assert.throws(()=>validateReport(long,['cohort-test']),{code:'report_too_long'});
});
test('Expired credentials produce actionable sanitized errors, never provider text or a fake report',async()=>{
  await assert.rejects(callOpenAI({key:'test',model:'test',packet,fetcher:async()=>new Response(JSON.stringify({error:{code:'expired_secret_key',message:'secret would leak here'}}),{status:401})}),error=>error.code==='credential_expired'&&!error.message.includes('would leak'));
});
test('Incomplete, refused and malformed responses cannot become PDFs',async()=>{
  for(const [response,code] of [[{status:'incomplete'},'report_incomplete'],[{status:'completed',output:[{content:[{type:'refusal',refusal:'No'}]}]},'model_refusal'],[{status:'completed',output:[]},'invalid_report']]){
    await assert.rejects(callOpenAI({key:'test',model:'test',packet,fetcher:async()=>new Response(JSON.stringify(response))}),{code});
  }
});
test('Network failures and rate limits are explicit',async()=>{
  await assert.rejects(callOpenAI({key:'test',model:'test',packet,fetcher:async()=>{throw new Error('secret')}}),{code:'provider_unavailable'});
  await assert.rejects(callOpenAI({key:'test',model:'test',packet,fetcher:async()=>new Response('{}',{status:429})}),{code:'provider_limit'});
});
test('Connection failures preserve safe diagnostics without exposing credentials or evidence',async()=>{
  const secret='test-only-secret';
  const cause=new AggregateError([Object.assign(new Error(secret),{code:'EPERM'}),Object.assign(new Error(secret),{code:secret})],secret);
  let calls=0;
  await assert.rejects(callOpenAI({key:secret,model:'test',packet,fetcher:async()=>{calls++;throw new TypeError(secret,{cause});}}),error=>{
    assert.equal(error.code,'provider_unavailable');assert.equal(error.status,502);
    assert.match(error.message,/server.*network access/);
    assert.deepEqual(error.diagnostics.networkCodes,['EPERM']);
    assert.ok(Number.isFinite(error.diagnostics.elapsedMs)&&error.diagnostics.elapsedMs>=0);
    assert.ok(!JSON.stringify(error).includes(secret));assert.ok(!error.message.includes(secret));
    return true;
  });
  assert.equal(calls,1,'An uncertain provider request must not be silently retried');
});
test('Request deadlines and connection timeouts are distinct from other network failures',async()=>{
  for(const failure of [new DOMException('sensitive timeout details','TimeoutError'),new TypeError('fetch failed',{cause:Object.assign(new Error('sensitive timeout details'),{code:'UND_ERR_CONNECT_TIMEOUT'})})]){
    await assert.rejects(callOpenAI({key:'test',model:'test',packet,fetcher:async()=>{throw failure;}}),error=>{
      assert.equal(error.code,'provider_timeout');assert.equal(error.status,504);
      assert.match(error.message,/timed out/);assert.ok(!JSON.stringify(error).includes('sensitive timeout details'));return true;
    });
  }
});
test('Only a completed overlong draft gets one bounded shortening pass',async()=>{
  const long=structuredClone(report);long.findings=Array.from({length:3},()=>({...report.findings[0],observation:'a '.repeat(170),reasoning:'a '.repeat(160),alternative:'a '.repeat(100),nextCheck:'a '.repeat(100)}));
  const overlong=()=>new Response(JSON.stringify({status:'completed',id:'long-draft',output:[{content:[{type:'output_text',text:JSON.stringify(long)}]}]}));
  let calls=0;
  const revised=await callOpenAI({key:'test',model:'test',packet,fetcher:async(url,options)=>{calls++;if(calls===1)return overlong();assert.ok(JSON.parse(JSON.parse(options.body).input).previousDraft);return success();}});
  assert.equal(calls,2);assert.equal(revised.revisions[0].responseId,'long-draft');
  calls=0;await assert.rejects(callOpenAI({key:'test',model:'test',packet,fetcher:async()=>{calls++;return overlong();}}),{code:'report_too_long'});assert.equal(calls,2);
});
test('Server recomputes verified facts instead of trusting modified browser numbers',async()=>{
  const fetcher=async path=>new Response(await readFile(new URL('../dist/'+path.replace(/^\.\//,''),import.meta.url)));
  const bundle=JSON.parse(await readFile(new URL('../dist/data-v2/bundle.json',import.meta.url)));
  const service=createService(bundle,{fetcher});const clues=createClueService(service,{fetcher});await clues.load();
  const submitted=clues.buildAnalysisPacket({focus:{pivot:'ap',id:'AP-04'}});
  submitted.aggregateValues.globalSummary.observationCount=99999999;
  const restored=await canonicalPacket(new URL('..',import.meta.url).pathname,submitted);
  assert.equal(restored.aggregateValues.globalSummary.observationCount,187163);assert.equal(restored.scope.focus.id,'AP-04');
  assert.ok(evidenceCatalog(restored).some(f=>f.id==='scope-and-coverage'));
  assert.deepEqual(evidenceCatalog(restored).find(f=>f.id==='selected-focus-comparison').values,restored.aggregateValues.comparison);
  assert.ok(!evidenceCatalog(packet).some(f=>f.id==='selected-focus-comparison'));
  const changed=structuredClone(submitted);changed.provenance.observationsSha256='0'.repeat(64);
  await assert.rejects(canonicalPacket(new URL('..',import.meta.url).pathname,changed),{code:'stale_evidence'});
  submitted.provenance.indexSha256='0'.repeat(64);
  await assert.rejects(canonicalPacket(new URL('..',import.meta.url).pathname,submitted),{code:'stale_evidence'});
});
