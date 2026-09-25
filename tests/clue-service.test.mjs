import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createService} from '../dist/js/service.js';
import {createClueService} from '../dist/js/clue-service.js';

const bundle=JSON.parse(await fs.readFile(new URL('../dist/data-v2/bundle.json',import.meta.url)));
const fetcher=async path=>new Response(await fs.readFile(new URL('../dist/'+path.replace(/^\.\//,''),import.meta.url),'utf8'));
const service=createService(bundle,{fetcher});
const clues=createClueService(service,{fetcher});await clues.load();
const sha=text=>createHash('sha256').update(text).digest('hex');
const at=(cutoffUs,releaseOrdinal=null,generation=0)=>({mode:'capture_replay',cutoffUs,releaseOrdinal,generation});

function fixture(observations,lastUs=100_000_000){
  const sources=[{id:'S01',sha256:'1'.repeat(64),channel:36,frequency:5180},{id:'S02',sha256:'2'.repeat(64),channel:40,frequency:5200}];
  const manifest={datasetId:'synthetic-unseen',aliasVersion:'test',firstUs:0,lastUs,sources,diagnostics:{indexSha256:'f'.repeat(64)}};
  const input=observations.map((e,i)=>({source:'S01',clients:['C-900'],ap:'AP-90',type:'Deauthentication',flags:4,reasonCode:7,statusCode:null,timeUs:i*1_000_000,releaseOrdinal:i+1,frameNumber:i+1,security:[null,null,null,null],...e})).sort((a,b)=>a.timeUs-b.timeUs||a.releaseOrdinal-b.releaseOrdinal);
  const clientNames=[...new Set(input.flatMap(e=>e.clients))],aps=[...new Set(input.map(e=>e.ap).filter(Boolean))],types=[...new Set(input.map(e=>e.type))],security=[...new Map(input.map(e=>[JSON.stringify(e.security),e.security])).values()];
  const data={encoding:'clue-tuples-2',datasetId:manifest.datasetId,firstUs:0,sources:sources.map(s=>s.id),clients:clientNames,aps,types,security,rows:input.map(e=>[e.timeUs,e.releaseOrdinal,sources.findIndex(s=>s.id===e.source),e.frameNumber,e.clients.map(c=>clientNames.indexOf(c)),e.ap?aps.indexOf(e.ap):-1,types.indexOf(e.type),e.flags,e.reasonCode,e.statusCode,security.findIndex(s=>JSON.stringify(s)===JSON.stringify(e.security)),e.sequence??null])};
  const dataText=JSON.stringify(data),meta={schemaVersion:'airframe-clues-data-1.0',datasetId:manifest.datasetId,aliasVersion:manifest.aliasVersion,sourceIndexSha256:manifest.diagnostics.indexSha256,path:'observations.json',sha256:sha(dataText),eventCount:input.length,sourceSources:sources,histories:Object.fromEntries(clientNames.map(c=>[c,{path:`clients/${c}.json`,sha256:'3'.repeat(64)}])),scope:'Synthetic sanitized published client observations.'},indexText=JSON.stringify(meta);
  const responses={'index.json':indexText,'observations.json':dataText};
  const baseService={manifest,loadDiagnostics:async()=>{},getQuality:()=>[]};
  return {input,manifest,integrity:{datasetId:manifest.datasetId,indexSha256:sha(indexText)},responses,service:baseService,fetcher:async path=>new Response(responses[path.split('/').at(-1)])};
}
async function synthetic(rows,lastUs){const f=fixture(rows,lastUs),c=createClueService(f.service,{fetcher:f.fetcher,integrity:f.integrity});await c.load();return {c,...f};}

test('Whole publication reconciles original observations; matrix and totals preserve exact members',()=>{
  const view=clues.getView();assert.equal(view.globalSummary.observationCount,187163);
  const terms=service.getPattern('PAT-23').eventCount+service.getPattern('PAT-2').eventCount;
  assert.ok(view.globalSummary.metrics.terminations.value>=terms);
  const ids=view.matrix.rows.flatMap(r=>r.cells.flatMap(c=>c.evidenceIds));assert.equal(new Set(ids).size,ids.length);
  assert.equal(ids.length,view.globalSummary.metrics.terminations.value);
  assert.equal(view.matrix.rows.reduce((n,r)=>n+(r.totals.value??0),0),ids.length);
  assert.ok(view.coverage.capabilities.some(c=>c.id==='sensor_health'&&c.state==='unavailable'));
  assert.equal(view.stages.find(s=>s.id==='application').count,null);
  assert.match(view.globalSummary.scope,/excludes beacon/i);
});

test('Replay gates every cell and clue by timestamp AND equal-time release ordinal',()=>{
  const first=service.getPattern('PAT-23').rows[0];
  const before=clues.getView({},at(first.timeUs,first.releaseOrdinal-1));
  assert.ok(!before.matrix.rows.flatMap(r=>r.cells.flatMap(c=>c.evidenceIds)).includes(first.id));
  const after=clues.getView({},at(first.timeUs,first.releaseOrdinal));
  assert.ok(after.matrix.rows.flatMap(r=>r.cells.flatMap(c=>c.evidenceIds)).includes(first.id));
  for(const id of after.clues.flatMap(c=>c.evidenceIds)){const frame=clues.inspectEvidence([id],at(first.timeUs,first.releaseOrdinal)).rows[0];assert.ok(frame.timeUs<=first.timeUs&&frame.releaseOrdinal<=first.releaseOrdinal);}
  assert.throws(()=>clues.inspectEvidence([first.id],at(first.timeUs-1)),{code:'outside_replay_cutoff'});
  const empty=clues.getView({},at(bundle.manifest.firstUs-1));assert.equal(empty.globalSummary.observationCount,0);assert.equal(empty.globalSummary.metrics.terminations.value,null);assert.equal(empty.matrix.rows.length,0);
});

test('AP focus retains global matrix, same-channel peers and exact denominators',()=>{
  const global=clues.getView(),focused=clues.getView({focus:{pivot:'ap',id:'AP-04'},metric:'retry_share'});
  assert.equal(focused.matrix.rows.length,global.matrix.rows.length);assert.equal(focused.globalSummary.observationCount,global.globalSummary.observationCount);
  assert.ok(focused.comparison.peers.length);assert.ok(focused.comparison.peers.every(p=>p.id!=='AP-04'));
  const focusRow=focused.matrix.rows.find(r=>r.id==='AP-04');assert.equal(focusRow.focus,true);
  const rate=focusRow.totals;assert.equal(rate.value,100*rate.numerator/rate.denominator);
  assert.equal(rate.numerator,focusRow.cells.reduce((n,c)=>n+(c.numerator??0),0));
  assert.equal(rate.denominator,focusRow.cells.reduce((n,c)=>n+(c.denominator??0),0));
  for(const peer of focused.comparison.peers){assert.ok(focused.matrix.rows.find(r=>r.id===peer.id).channels.some(ch=>focusRow.channels.includes(ch)));}
  assert.ok(focused.clues.some(c=>!c.focusMatch),'Global candidates remain discoverable outside the clicked AP');
});

test('Generic unseen reason and 7-second cadence are detected without sample-specific counts',async()=>{
  const rows=[];for(let i=0;i<6;i++)rows.push({timeUs:i*7_000_000,reasonCode:9,clients:['C-900','C-901']});
  const {c}=await synthetic(rows);const view=c.getView({binCount:4});
  const recurrence=view.clues.find(c=>c.family==='recurrence');assert.ok(recurrence);assert.equal(recurrence.groups.length,2);
  assert.deepEqual(recurrence.groups.map(g=>g.client).sort(),['C-900','C-901']);
  assert.ok(recurrence.groups.every(g=>g.reasonCode===9&&g.medianIntervalSeconds===7));
  assert.equal(view.composition.terminationReasons[0].id,'9');assert.equal(view.composition.terminationReasons[0].count,6);
  assert.equal(view.globalSummary.metrics.terminations.value,6,'Multi-client membership must not double-count global original observations');
  assert.equal(c.getView({pivot:'client'}).matrix.rows.length,2);
});

test('Client peers require association observations; probe recipients are not associated load',async()=>{
  const {c}=await synthetic([
    {type:'Association response',statusCode:0,clients:['C-900']},
    {type:'Association response',statusCode:0,clients:['C-901']},
    {type:'Probe response',clients:['C-902']},
    {type:'Probe response',clients:['C-903']}
  ]);
  const v=c.getView({focus:{pivot:'client',id:'C-900'}});assert.deepEqual(v.comparison.peers.map(p=>p.id),['C-901']);assert.equal(v.globalSummary.clientCount,4);assert.equal(v.globalSummary.associatedClientCount,2);
  const probe=c.getView({focus:{pivot:'client',id:'C-902'}});assert.equal(probe.comparison.peers.length,0);assert.match(probe.comparison.basis,/unavailable/);
});

test('Fixed elapsed-time lead is general and later protected data counters a progression-gap lead',async()=>{
  const rows=[];let ordinal=1;
  for(let i=0;i<6;i++){
    rows.push({timeUs:i*10_000_000,type:'Association response',statusCode:0,releaseOrdinal:ordinal,frameNumber:ordinal++});
    rows.push({timeUs:i*10_000_000+7_000_000,reasonCode:8,releaseOrdinal:ordinal,frameNumber:ordinal++});
  }
  const {c}=await synthetic(rows);let v=c.getView();const delay=v.clues.find(c=>c.family==='elapsed_time');assert.equal(delay.statistics.medianSeconds,7);assert.equal(delay.statistics.matchingPairCount,6);assert.ok(v.clues.some(c=>c.family==='progression'));
  rows.push({timeUs:60_000_000,type:'Data',flags:6,releaseOrdinal:ordinal,frameNumber:ordinal++});
  const alternate=await synthetic(rows);v=alternate.c.getView();assert.ok(!v.clues.some(c=>c.family==='progression'));assert.equal(v.stages.find(s=>s.id==='protected').count,1);
});

test('Shared-time rise works across unseen APs, while unsupported publication bins do not become baseline zero',async()=>{
  const rows=[];let n=1;
  for(let b=0;b<4;b++){rows.push({timeUs:b*25_000_000+1,type:'Probe request',frameNumber:n,releaseOrdinal:n++});for(let j=0;j<(b===2?12:1);j++)rows.push({timeUs:b*25_000_000+10+j,ap:`AP-${90+j%3}`,clients:[`C-${900+j%3}`],frameNumber:n,releaseOrdinal:n++});}
  const {c}=await synthetic(rows);const shared=c.getView({binCount:4}).clues.find(c=>c.family==='shared_timing');assert.ok(shared);assert.equal(shared.statistics.apCount,3);assert.equal(shared.statistics.medianBinCount,1);
  const onlyBurst=await synthetic(rows.filter(e=>e.timeUs>=50_000_000&&e.timeUs<75_000_000));assert.ok(!onlyBurst.c.getView({binCount:4}).clues.some(c=>c.family==='shared_timing'),'Unobserved windows do not supply a zero baseline');
});

test('Observed zero, unavailable ratio, and no observations remain distinct',async()=>{
  const {c}=await synthetic([{timeUs:0,type:'Probe request'},{timeUs:30_000_000,type:'ACK',flags:0}]);
  const v=c.getView({binCount:4});assert.equal(v.matrix.rows[0].cells[0].value,0);assert.equal(v.matrix.rows[0].cells[2].value,null);
  const retries=c.getView({metric:'retry_share',binCount:4});assert.equal(retries.matrix.rows[0].cells[1].value,null);assert.equal(retries.matrix.rows[0].cells[1].denominator,0);
  const unknown=c.getView({focus:{pivot:'ap',id:'AP-999'}});assert.equal(unknown.comparison.focus.metrics.terminations.value,null);assert.equal(unknown.comparison.peers.length,0);
});

test('Integer microsecond bin boundaries use displayed boundaries exactly',async()=>{
  const {c}=await synthetic([{timeUs:0},{timeUs:25},{timeUs:50},{timeUs:75},{timeUs:101}],101);
  const v=c.getView({binCount:4});assert.deepEqual(v.matrix.bins.map(b=>b.startUs),[0,25,50,75]);assert.deepEqual(v.matrix.rows[0].cells.map(b=>b.value),[1,1,1,2]);
  const point=c.getView({startUs:25,endUs:25});assert.equal(point.matrix.bins.length,1);assert.equal(point.globalSummary.observationCount,1);
});

test('A future selected window after backwards replay seek remains requested but has no effective bins',async()=>{
  const {c}=await synthetic([{timeUs:0},{timeUs:80_000_000}]);
  const query={startUs:70_000_000,endUs:90_000_000};
  const future=c.getView(query,at(20_000_000));
  assert.equal(future.query.startUs,70_000_000);assert.equal(future.query.endUs,90_000_000);
  assert.equal(future.window.state,'not_yet_admitted');assert.equal(future.window.startUs,null);assert.equal(future.window.endUs,null);assert.equal(future.window.available,false);
  assert.deepEqual(future.matrix.bins,[]);assert.deepEqual(future.matrix.rows,[]);assert.equal(future.globalSummary.metrics.terminations.value,null);assert.ok(future.trends.every(t=>t.values.length===0));
  const packet=c.buildAnalysisPacket(query,at(20_000_000));assert.equal(packet.scope.startUs,70_000_000);assert.equal(packet.scope.endUs,90_000_000);assert.deepEqual(packet.aggregateValues.bins,[]);assert.equal(packet.window.state,'not_yet_admitted');assert.equal(packet.evidence.samples.length,0);
  const beforeCapture=c.getView({},at(-1));assert.equal(beforeCapture.window.state,'not_yet_admitted');assert.equal(beforeCapture.window.startUs,null);assert.equal(beforeCapture.window.endUs,null);assert.deepEqual(beforeCapture.matrix.bins,[]);
  const partial=c.getView(query,at(80_000_000));assert.equal(partial.window.startUs,70_000_000);assert.equal(partial.window.endUs,80_000_000);assert.equal(partial.query.endUs,90_000_000);assert.ok(partial.matrix.bins.every(b=>b.startUs<=80_000_000&&b.endUs<=80_000_000));assert.equal(partial.globalSummary.observationCount,1);
});

test('Hash failures are errors, not zero, and do not poison retry',async()=>{
  const f=fixture([{timeUs:0}]);let broken=true;
  const c=createClueService(f.service,{integrity:f.integrity,fetcher:async path=>new Response(f.responses[path.split('/').at(-1)]+(broken?' ':''))});
  await assert.rejects(c.load(),{code:'capture_hash_mismatch'});assert.throws(()=>c.getView(),{code:'evidence_unavailable'});
  broken=false;await c.load();assert.equal(c.getView().globalSummary.observationCount,1);
});

test('Asynchronous stale generation cannot update a newer selection',async()=>{
  const f=fixture([{timeUs:0}]);let release;
  const c=createClueService(f.service,{integrity:f.integrity,fetcher:async path=>{if(path.endsWith('observations.json'))await new Promise(resolve=>release=resolve);return f.fetcher(path);}});
  const pending=c.load(at(100_000_000,null,1));while(!release)await new Promise(resolve=>setTimeout(resolve,1));c.setContext(at(0,null,2));const current=c.load(at(0,null,2));release();
  await assert.rejects(pending,{code:'stale_generation'});await current;assert.equal(c.getView({},at(0,null,2)).globalSummary.observationCount,1);assert.throws(()=>c.getView({},at(0,null,1)),{code:'stale_generation'});
});

test('AI handoff is compact JSON with denominators, explicit sampling, exact resolution and no direct model call',()=>{
  const packet=clues.buildAnalysisPacket({focusAp:'AP-04'}),serialized=JSON.stringify(packet),roundtrip=JSON.parse(serialized);
  assert.ok(serialized.length<175_000,`Packet size ${serialized.length} exceeds the enriched default-scope budget`);
  assert.equal(roundtrip.schemaVersion,'airframe-analysis-packet-1.0');assert.equal(roundtrip.transport.modelCallMade,false);assert.equal(roundtrip.scope.focusIsNotGlobalFilter,true);
  assert.match(roundtrip.aggregateValues.encoding.evidencePolicy,/omitted/);assert.equal(roundtrip.aggregateValues.encoding.cellColumns.length,5);
  assert.match(roundtrip.evidence.resolution.projectionSha256,/^[a-f0-9]{64}$/);assert.ok(roundtrip.evidence.samples.length<=16);
  assert.equal(roundtrip.engineerContext.state,'not_provided');assert.ok(roundtrip.unknowns.length);
  assert.ok(roundtrip.clues.every(c=>typeof c.predicate==='string'&&c.cause==='Unresolved'));
  assert.ok(!/(?:[0-9a-f]{2}:){5}[0-9a-f]{2}/i.test(serialized));
  assert.ok(!/"(?:payload|rawBytes|eapIdentity|transmitter|receiver)"\s*:/.test(serialized));
  const clientPacket=clues.buildAnalysisPacket({pivot:'client'});assert.equal(clientPacket.aggregateValues.matrix.rows.length,60);assert.equal(clientPacket.aggregateValues.matrix.omittedRows,63);
});

test('Computed cohort facts expose order, separate cadence groups and same-interface counterexamples',()=>{
  const v=clues.getView({focusAp:'AP-04'}),get=id=>v.analysisFacts.find(f=>f.id===id);
  assert.equal(v.clientCohorts.rows.length,123);assert.equal(v.clientCohorts.rows.filter(r=>r.firstAssociationUs!==null).length,87);
  const order=get('join-order-eap_observed-reason-2');assert.equal(order.values.associatedCohortCount,63);assert.equal(order.values.recurringClientCount,18);assert.equal(order.values.allRecurringAreEarliest,true);assert.equal(order.values.maximumJoinRank,18);
  const cadence=get('cadence-groups-reason-2');assert.deepEqual(cadence.values.clusters.map(c=>c.clientCount),[11,7]);assert.equal(cadence.values.groupCount,18);
  assert.equal(get('same-bssid-counterexamples-reason-2').values.clientsWithCounterexamples,18);
  const transition=get('reason-transition-23-to-2');assert.equal(transition.values.clientCount,18);assert.equal(transition.values.noReturnToEarlierReasonClients,18);assert.equal(transition.values.successfulAssociationsAfterOnset,133);
  assert.equal(v.profileCohorts.state,'unavailable');assert.ok(v.profileCohorts.rows.length===0);assert.ok(v.profileCohorts.limitations.some(x=>/SSID|AKM/.test(x)));
  const keys=v.protocolCohorts.rows.find(r=>r.id==='keys_observed');assert.equal(keys.associatedClientCount,24);assert.equal(keys.protectedAssociatedClientCount,24);
  const readmission=get('readmission-reason-23');assert.equal(readmission.values.pairedClients,63);assert.equal(readmission.values.intervalBuckets[0].centerSeconds,13);assert.equal(readmission.values.intervalBuckets[0].count,60);
  assert.equal(v.matrix.rows.find(r=>r.id==='AP-04').associatedClientCount,3);
});

test('Parsed EAP identifiers expose the dominant interval without claiming method completion',()=>{
  const v=clues.getView(),summary=v.eapProtocolSummary;
  assert.equal(summary.requests,1692);assert.equal(summary.responses,319);assert.equal(summary.successes,0);assert.equal(summary.failures,0);
  const thirty=summary.intervalBuckets.find(b=>b.centerSeconds===30);assert.equal(thirty.count,1001);assert.equal(thirty.changedIdentifiers,999);assert.equal(thirty.unchangedIdentifiers,2);
  assert.equal(summary.responsePairs.length+summary.unmatchedResponseIds.length,319);
  const frame=clues.inspectEvidence(['S03-1139']).rows[0];assert.equal(frame.security.identifier,157);assert.match(frame.label,/Request.*157/);
  const packet=clues.buildAnalysisPacket();assert.ok(packet.analysisFacts.some(f=>f.id==='eap-protocol-summary'));assert.ok(packet.analysisFacts.every(f=>f.evidenceIds.total>=f.evidenceIds.sample.length));
});

test('Unseen cohort/reason ordering and protocol evidence remain causal under replay',async()=>{
  const rows=[];let n=1;const push=e=>rows.push({frameNumber:n,releaseOrdinal:n++,...e});
  for(let c=0;c<4;c++){push({timeUs:c*1_000_000,type:'Association response',statusCode:0,clients:[`C-${900+c}`]});push({timeUs:c*1_000_000+100,type:'QoS data',clients:[`C-${900+c}`],security:['EAP',1,25,null,41+c,null]});if(c<3)for(let i=0;i<6;i++)push({timeUs:10_000_000+c*100+i*7_000_000,clients:[`C-${900+c}`],reasonCode:9});}
  const {c}=await synthetic(rows),v=c.getView(),order=v.analysisFacts.find(f=>f.id==='join-order-eap_observed-reason-9');assert.ok(order);assert.equal(order.values.associatedCohortCount,4);assert.equal(order.values.recurringClientCount,3);assert.equal(order.values.allRecurringAreEarliest,true);
  const before=c.getView({},at(9_000_000));assert.ok(!before.analysisFacts.some(f=>f.id==='join-order-eap_observed-reason-9'));assert.ok(before.clientCohorts.rows.every(r=>r.firstReason2Us===null));
  const narrow=c.getView({startUs:20_000_000,endUs:50_000_000});assert.ok(narrow.clientCohorts.rows.every(r=>r.firstAssociationUs<20_000_000));for(const f of narrow.analysisFacts.filter(f=>f.family==='readmission'||f.family==='reason_transition'||f.family==='join_order'))assert.equal(f.scope.includesPriorContext,true);
});

test('Attempt sequences retain EAP IDs, retry-suppress associations, and declare both censoring boundaries',async()=>{
  const rows=[
    {timeUs:0,type:'QoS data',security:['EAP',1,1,null,1,null]},
    {timeUs:1_000_000,type:'Association response',statusCode:0,sequence:7},
    {timeUs:1_500_000,type:'Association response',statusCode:0,sequence:7,flags:5},
    {timeUs:2_000_000,type:'QoS data',security:['EAP',1,1,null,44,null]},
    {timeUs:2_100_000,type:'QoS data',security:['EAP',2,1,null,44,null]},
    {timeUs:3_000_000,type:'QoS data',security:['EAP',1,1,null,45,null]},
    {timeUs:4_000_000,reasonCode:9},
    {timeUs:8_000_000,type:'Association response',statusCode:0,sequence:8}
  ];
  const {c}=await synthetic(rows),all=c.getClientAttempts('C-900',{},at(9_000_000));assert.equal(all.total,3);
  assert.equal(all.attempts[0].censoring.left,true);assert.equal(all.attempts[0].startUs,null);
  const complete=all.attempts[1];assert.equal(complete.startUs,1_000_000);assert.equal(complete.endUs,4_000_000);assert.equal(complete.elapsedSeconds,3);assert.equal(complete.events.filter(e=>e.retryOf).length,1);assert.equal(complete.eapPairs.length,1);assert.equal(complete.eapPairs[0].identifier,44);assert.equal(complete.censoring.right,false);
  assert.equal(all.attempts[2].closedBy,'window_end');assert.equal(all.attempts[2].censoring.right,true);assert.equal(all.attempts[2].endUs,9_000_000);
  const selected=c.getClientAttempts('C-900',{startUs:2_000_000},at(3_000_000));assert.equal(selected.total,1);assert.equal(selected.attempts[0].startedBeforeWindow,true);assert.ok(selected.attempts[0].events.every(e=>e.timeUs<=3_000_000));assert.equal(selected.attempts[0].censoring.right,true);
  const page=c.getClientAttempts('C-900',{attemptPageSize:1,attemptPage:1},at(9_000_000));assert.equal(page.total,3);assert.equal(page.attempts.length,1);assert.equal(page.nextPage,2);
  const future=c.getClientAttempts('C-900',{startUs:20_000_000},at(9_000_000));assert.equal(future.total,0);
});

test('Narrow-window recurrence does not erase earlier silent rank comparators',async()=>{
  const rows=[];let ordinal=1;const push=e=>rows.push({frameNumber:ordinal,releaseOrdinal:ordinal++,...e});
  for(let i=0;i<4;i++){push({timeUs:i*1_000_000,type:'Association response',statusCode:0,clients:[`C-${900+i}`]});push({timeUs:i*1_000_000+1,type:'QoS data',clients:[`C-${900+i}`],security:['EAP',1,1,null,10+i,null]});if(i>0)for(let j=0;j<6;j++)push({timeUs:20_000_000+j*7_000_000+i,reasonCode:9,clients:[`C-${900+i}`]});}
  const {c}=await synthetic(rows);const v=c.getView({startUs:20_000_000});assert.equal(v.clientCohorts.rows.length,3);
  const fact=v.analysisFacts.find(f=>f.id==='join-order-eap_observed-reason-9');assert.equal(fact.values.associatedCohortCount,4);assert.equal(fact.values.minimumJoinRank,2);assert.equal(fact.values.allRecurringAreEarliest,false);assert.equal(fact.values.leadingRecurringPrefixCount,0);
});

test('Same-interface counterexamples anchor target onset to that interface and source',async()=>{
  const rows=[];let ordinal=1;const push=e=>rows.push({frameNumber:ordinal,releaseOrdinal:ordinal++,...e});
  for(const [client,ap,timeUs]of [['C-900','AP-90',0],['C-900','AP-91',1_000_000],['C-901','AP-91',2_000_000]]){push({client,timeUs,type:'Association response',statusCode:0,clients:[client],ap});push({timeUs:timeUs+1,type:'QoS data',clients:[client],ap,security:['EAP',1,1,null,1,null]});}
  push({timeUs:3_000_000,clients:['C-900'],ap:'AP-90',reasonCode:9});
  push({timeUs:10_000_000,clients:['C-901'],ap:'AP-91',reasonCode:7});
  for(let i=0;i<6;i++)push({timeUs:20_000_000+i*7_000_000,clients:['C-900'],ap:'AP-91',reasonCode:9});
  const {c}=await synthetic(rows);assert.ok(!c.getView().analysisFacts.some(f=>f.id==='same-bssid-counterexamples-reason-9'),'Peer termination before AP-91 target onset is not a later counterexample');
});

test('Reason-time and discovery series reconcile to original focused members',()=>{
  const v=clues.getView({focusAp:'AP-04'});
  for(const reason of v.reasonTrends){const ids=reason.values.flatMap(v=>v.evidenceIds);assert.equal(ids.length,v.composition.terminationReasons.find(r=>r.id===String(reason.reasonCode)).count);assert.equal(new Set(ids).size,ids.length);}
  for(const trend of v.discoveryTrends){const type=trend.id==='probe_requests'?'Probe request':'Probe response';assert.equal(trend.values.reduce((n,c)=>n+(c.numerator??0),0),v.composition.types.find(t=>t.id===type)?.count??0);}
  const short=clues.getView({startUs:bundle.manifest.firstUs+900_000_000,endUs:bundle.manifest.lastUs});assert.ok(short.analysisFacts.filter(f=>['join_order','reason_transition'].includes(f.family)).every(f=>f.scope.includesPriorContext&&f.scope.evidenceStartUs===bundle.manifest.firstUs));
});

test('AI packet and canonical retrieval cannot leak unreleased observations',()=>{
  const first=service.getPattern('PAT-23').rows[0],packet=clues.buildAnalysisPacket({},at(first.timeUs,first.releaseOrdinal));
  assert.ok(packet.evidence.samples.every(e=>e.timeUs<=first.timeUs&&e.releaseOrdinal<=first.releaseOrdinal));
  assert.deepEqual(packet.evidence.resolution.context,packet.context);
  for(const clue of packet.clues)for(const id of clue.evidenceIds.sample)assert.ok(clues.inspectEvidence([id],packet.context).rows[0].timeUs<=first.timeUs);
  assert.throws(()=>clues.getView({metric:'invented_health'}),{code:'invalid_filter'});
  assert.throws(()=>clues.getView({startUs:bundle.manifest.lastUs,endUs:bundle.manifest.firstUs}),{code:'invalid_filter'});
});
