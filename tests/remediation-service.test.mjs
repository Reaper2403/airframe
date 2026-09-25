import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createDiagnosticService} from '../dist/js/diagnostic-service.js';
const bundle=JSON.parse(await fs.readFile(new URL('../dist/data-v2/bundle.json',import.meta.url)));
const manifest=bundle.manifest;
const fetcher=async path=>new Response(await fs.readFile(new URL('../dist/'+path.replace(/^\.\//,''),import.meta.url),'utf8'));
const service=createDiagnosticService(manifest,{fetcher});
await service.loadDiagnostics();
const historical={mode:'historical_review',generation:0};
const at=(cutoffUs,generation=0,releaseOrdinal=null)=>({mode:'capture_replay',cutoffUs,generation,releaseOrdinal});

test('Full capture reason patterns reconcile to exact members and globally deduplicated clients',()=>{
 const auth=service.getPattern('PAT-23'),loop=service.getPattern('PAT-2');
 assert.equal(auth.eventCount,506);assert.equal(auth.clientCount,63);assert.equal(auth.sourceCount,8);
 assert.equal(loop.eventCount,1477);assert.equal(loop.clientCount,18);assert.equal(loop.recurringClientCount,18);
 for(const p of [auth,loop]){assert.equal(new Set(p.rows.map(e=>e.id)).size,p.eventCount);assert.equal(new Set(p.rows.map(e=>e.client)).size,p.clientCount);assert.equal(p.clients.reduce((n,c)=>n+c.count,0),p.eventCount);assert.match(p.predicate,/not a shared.cause/i);}
});
test('Pattern, quality, inventory and exact frames respect timestamp and release ordinal',async()=>{
 const p=service.getPattern('PAT-23');const first=p.rows[0];
 assert.equal(service.getPattern('PAT-23',at(first.timeUs-1)).eventCount,0);
 for(const c of [at(first.timeUs),at(first.timeUs,0,first.releaseOrdinal-1),at(first.timeUs,0,first.releaseOrdinal)]){
  const result=service.getPattern('PAT-23',c);assert.ok(result.rows.every(e=>e.timeUs<=c.cutoffUs&&(c.releaseOrdinal===null||e.releaseOrdinal<=c.releaseOrdinal)));
  for(const q of service.getQuality(c)){assert.ok(q.discoveredAtUs<=c.cutoffUs);for(const id of q.evidenceIds){const frame=await service.getFrameAsync(id,c);assert.ok(frame.timeUs<=c.cutoffUs);}}
 }
 await assert.rejects(service.getFrameAsync(first.id,at(first.timeUs-1)),{code:'outside_replay_cutoff'});
});
test('History is wider than episode, complete pagination has no duplicated or omitted members',async()=>{
 const first=await service.getClientHistory('C-004',{pageSize:500});assert.ok(first.total>221);assert.ok(first.firstUs<bundle.incidents[0].openUs);
 const ids=[];for(let page=0;page*500<first.total;page++){const result=await service.getClientHistory('C-004',{page,pageSize:500});ids.push(...result.rows.map(e=>e.id));assert.equal(result.total,first.total);}
 assert.equal(ids.length,first.total);assert.equal(new Set(ids).size,first.total);
 assert.ok(first.securityProgression.stages.find(s=>s.id==='eap').count>0);assert.equal(first.securityProgression.service.state,'unavailable');
});
test('Security filter selects real metadata and source/transmitter filters preserve predicate',async()=>{
 const result=await service.getClientHistory('C-004',{stage:'eap',pageSize:500});assert.ok(result.total>0);assert.ok(result.rows.every(e=>e.security?.protocol==='EAP'));
 const f=result.rows[0];const narrowed=await service.getClientHistory('C-004',{stage:'eap',source:f.source,transmitter:f.transmitter,pageSize:500});assert.ok(narrowed.rows.every(e=>e.source===f.source&&e.transmitter===f.transmitter));
 await assert.rejects(service.getClientHistory('C-004',{pageSize:501}),{code:'invalid_filter'});
 const empty=await service.getClientHistory('C-004',{transmitter:'AP-NO-MATCH'});assert.equal(empty.total,0);assert.match(empty.scope.completeness,/complete/);
});
test('Probe retry groups preserve transmitter-specific numerator and denominator',()=>{
 const incident=bundle.incidents.find(e=>e.id==='AF-104');const ids=new Set(incident.evidenceIds);const endUs=bundle.events.find(e=>e.id===incident.associationId).timeUs;const rows=bundle.events.filter(e=>ids.has(e.id)&&e.timeUs>=incident.openUs&&e.timeUs<=endUs);const result=service.analyzeRetries(rows);
 assert.equal(result.retryCount,46);assert.ok(result.groups.length>1);assert.equal(result.groups.reduce((n,g)=>n+g.retryCount,0),46);
 for(const g of result.groups){assert.equal(g.denominator,g.initialCount+g.retryCount);assert.equal(g.retryObservationPercent,100*g.retryCount/g.denominator);assert.equal(g.matchedRetryCount+g.unmatchedRetryCount,g.retryCount);assert.match(g.ackVisibility,/not proof of loss/);}
 assert.match(result.predicate,/not packet.loss percentage/);
});
test('Failure meaning and evidence request do not invent root cause, lockout or service success',async()=>{
 const f=await service.getFrameAsync('S03-5099');assert.match(f.reasonMeaning,/802\.1X/);
 const request=service.prepareEvidenceRequest('C-005');assert.equal(request.client,'C-005');assert.match(request.status,/not sent/);assert.ok(request.systems.some(x=>/AAA/.test(x)));assert.match(request.purpose,/association alone does not close/i);
 assert.equal(service.getInventory().expectedInventory,'Unavailable');assert.match(service.getInventory().limitations.join(' '),/not mean offline/);
});
test('Security progression cannot adopt another client or non-open authentication as observed',()=>{
 const timeUs=manifest.firstUs+100;const base={id:'S01-100',timeUs,releaseOrdinal:1,source:'S01',bssid:'AP-01',frameType:0,transmitter:'AP-01',receiver:'C-004'};
 const rows=[{...base,type:'Authentication',statusCode:0,authAlgorithm:1},{...base,id:'S01-101',type:'Association response',statusCode:0,receiver:'C-005'}];
 const result=service.getSecurityProgression('C-004',rows);assert.equal(result.stages.find(s=>s.id==='open_authentication').count,0);assert.equal(result.stages.find(s=>s.id==='association').count,0);
});
test('Missing M2 stays unobserved while admitted M3 counters a stopped-exchange claim',()=>{
 const timeUs=manifest.firstUs+100;const frame={id:'S01-100',timeUs,releaseOrdinal:1,source:'S01',bssid:'AP-01',transmitter:'AP-01',receiver:'C-004',security:{protocol:'EAPOL-Key',keyStage:'M3',replayCounter:'2',label:'EAPOL key M3'}};
 const result=service.getSecurityProgression('C-004',[frame]);assert.equal(result.counts['EAPOL key M2'],undefined);assert.equal(result.counts['EAPOL key M3'],1);assert.equal(result.contradictions.length,1);assert.equal(result.securityCompletion.state,'unverified');
 assert.equal(service.getSecurityProgression('C-004',[frame],at(timeUs-1)).contradictions.length,0);
});
test('Failed chunk is unavailable not zero; retry succeeds without poisoned cache',async()=>{
 let fail=true;const local=createDiagnosticService(manifest,{fetcher:async path=>path.includes('/clients/')&&fail?{ok:false}:fetcher(path)});await local.loadDiagnostics();
 await assert.rejects(local.getClientHistory('C-004'),{code:'evidence_unavailable'});fail=false;assert.ok((await local.getClientHistory('C-004')).total>0);
});
test('Late old-generation asynchronous response is rejected after context change',async()=>{
 let release;const local=createDiagnosticService(manifest,{fetcher:async path=>{if(path.includes('/clients/'))await new Promise(r=>release=r);return fetcher(path);}});await local.loadDiagnostics();
 const pending=local.getClientHistory('C-004',{},at(manifest.lastUs,1));while(!release)await new Promise(r=>setTimeout(r,1));local.setDiagnosticContext(at(manifest.firstUs,2));release();await assert.rejects(pending,{code:'stale_generation'});
});
test('Diagnostic index identity mismatch fails instead of adopting a foreign dataset',async()=>{
 const local=createDiagnosticService(manifest,{fetcher:async()=>({ok:true,json:async()=>({datasetId:'wrong',patternEvents:[],clients:[]})})});await assert.rejects(local.loadDiagnostics(),{code:'capture_hash_mismatch'});
});
test('Every quality finding exposes paginated membership, not only illustrative samples',async()=>{
 for(const finding of service.getQuality()){
  const first=await service.getQualityDetails(finding.id,{pageSize:7});assert.equal(first.total,finding.count);assert.ok(first.rows.length>0);assert.equal(first.rows.length,Math.min(7,first.total));
  const lastPage=Math.floor((first.total-1)/7);const last=await service.getQualityDetails(finding.id,{page:lastPage,pageSize:7});assert.equal(last.nextPage,null);assert.equal(last.rows.length,first.total-lastPage*7);
  for(const e of [...first.rows,...last.rows]){assert.equal(e.source,finding.source);assert.equal((await service.getFrameAsync(e.id)).id,e.id);}
  const cut=first.rows[0];const prefix=await service.getQualityDetails(finding.id,{pageSize:500},at(cut.timeUs,0,cut.releaseOrdinal));assert.ok(prefix.rows.every(e=>e.timeUs<=cut.timeUs&&e.releaseOrdinal<=cut.releaseOrdinal));
 }
});
test('Published client registry covers non-AP identities beyond curated and transmitting clients',async()=>{
 const index=JSON.parse(await fs.readFile(new URL('../dist/data-v3/index.json',import.meta.url)));assert.equal(index.clients.length,123);assert.equal(new Set(index.clients.map(c=>c.client)).size,123);
 const nonC=index.clients.find(c=>!c.client.startsWith('C-'));assert.ok(nonC,'Non-C alias role coverage is missing');const history=await service.getClientHistory(nonC.client);assert.equal(history.client,nonC.client);assert.ok(history.total>0);
});
test('Actual key-message matching finds five sequences on four clients without service success',async()=>{
 const index=JSON.parse(await fs.readFile(new URL('../dist/data-v3/index.json',import.meta.url)));let exchanges=0;const clients=[];
 for(const entry of index.clients){const data=JSON.parse(await fs.readFile(new URL('../dist/data-v3/'+entry.path,import.meta.url)));if(!data.events.some(e=>e.security?.keyStage==='M4'))continue;const progression=service.getSecurityProgression(entry.client,data.events);if(progression.completeKeyExchanges.length)clients.push(entry.client);exchanges+=progression.completeKeyExchanges.length;assert.equal(progression.service.state,'unavailable');for(const sequence of progression.completeKeyExchanges){const rows=sequence.evidenceIds.map(id=>data.events.find(e=>e.id===id));assert.deepEqual(rows.map(e=>e.security.keyStage),['M1','M2','M3','M4']);assert.ok(rows.every((e,i)=>!i||e.timeUs>=rows[i-1].timeUs));assert.match(sequence.predicate,/No MIC verification or service claim/);}}
 assert.equal(exchanges,5);assert.equal(new Set(clients).size,4);
});
test('Key exchange completion is withheld until M4 is admitted by replay',async()=>{
 const data=JSON.parse(await fs.readFile(new URL('../dist/data-v3/clients/C-037.json',import.meta.url)));const m4=data.events.find(e=>e.id==='S05-13642');assert.ok(m4);const before=service.getSecurityProgression('C-037',data.events,at(m4.timeUs-1));assert.ok(before.completeKeyExchanges.every(x=>!x.evidenceIds.includes(m4.id)));const after=service.getSecurityProgression('C-037',data.events,at(m4.timeUs,0,m4.releaseOrdinal));assert.ok(after.completeKeyExchanges.some(x=>x.evidenceIds.includes(m4.id)));assert.equal(after.service.state,'unavailable');
});
test('Changed diagnostic index and client chunk are rejected by byte hash integrity',async()=>{
 for(const target of ['index.json','clients/C-004.json']){const local=createDiagnosticService(manifest,{fetcher:async path=>{const response=await fetcher(path);const body=await response.text();return new Response(path.endsWith(target)?body+' ':body);}});if(target==='index.json')await assert.rejects(local.loadDiagnostics(),{code:'capture_hash_mismatch'});else{await local.loadDiagnostics();await assert.rejects(local.getClientHistory('C-004'),{code:'capture_hash_mismatch'});}}
});
