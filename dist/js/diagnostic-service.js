/** Sanitized full-capture diagnostic projections. No packet bytes or identities. */
const copy = value => structuredClone(value);
const reasonMeaning = reason => ({23:'Reported IEEE 802.1X authentication failure',2:'Previous authentication no longer valid'})[reason] ?? 'Reason not interpreted';
const limits = ['Physical timing and cross-source alignment are unvalidated; inspect admitted capture-quality findings.', 'Missing captured exchanges do not alone prove failure.', 'Controller, AAA, supplicant and service evidence are not connected.'];
function error(code,message){const e=new Error(message);e.name='EvidenceError';e.code=code;e.retryable=code==='evidence_unavailable';throw e;}
export function createDiagnosticService(manifest, options={}) {
  const fetcher=options.fetcher ?? (path=>fetch(path));
  const base=options.diagnosticBase ?? './data-v3/';
  let index=null, quality=null, loading=null, newestGeneration=-1;
  const clients=new Map(), frames=new Map(), qualityParts=new Map();
  function resolvedFrame(id){const e=frames.get(id);if(e?.parseState==='quality_metadata'){const full=clients.get(index?.frameLookup?.[id])?.find(row=>row.id===id);if(full)return {...full,qualityFinding:e.qualityFinding};}return e;}
  function context(input={}){
    const mode=input.mode??'historical_review';
    if(!['historical_review','capture_replay'].includes(mode))error('invalid_filter','Unknown analysis mode.');
    const cutoffUs=mode==='historical_review'?manifest.lastUs:input.cutoffUs;
    const generation=input.generation??0, releaseOrdinal=mode==='capture_replay'?(input.releaseOrdinal??null):null;
    if(!Number.isSafeInteger(cutoffUs)||!Number.isSafeInteger(generation)||generation<0||(releaseOrdinal!==null&&(!Number.isSafeInteger(releaseOrdinal)||releaseOrdinal<0)))error('invalid_filter','Invalid diagnostic replay context.');
    return {datasetId:manifest.datasetId,schemaVersion:'3.0',parserVersion:'airframe-security-3.0',detectorVersion:'diagnostic-3.0',aliasVersion:manifest.aliasVersion,mode,cutoffUs,releaseOrdinal,generation};
  }
  function visible(e,c){return e.timeUs<=c.cutoffUs&&(c.releaseOrdinal===null||e.releaseOrdinal<=c.releaseOrdinal);}
  function announce(c){newestGeneration=Math.max(newestGeneration,c.generation);}
  function fresh(c){if(c.generation<newestGeneration)error('stale_generation','The requested evidence belongs to an earlier analysis context.');}
  async function read(path,expectedHash=null){
    let response;
    try{response=await fetcher(base+path);if(response?.ok===false)error('evidence_unavailable','Evidence could not be loaded. No conclusion about this selection is available.');if(expectedHash){if(typeof response?.text!=='function')error('capture_hash_mismatch','Evidence transport cannot verify serialized partition integrity.');const text=await response.text();const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));const hash=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');if(hash!==expectedHash)error('capture_hash_mismatch','Sanitized evidence partition failed content verification.');return JSON.parse(text);}return typeof response?.json==='function'?await response.json():response;}
    catch(e){if(e.code)throw e;error('evidence_unavailable','Evidence could not be loaded. Retry this selection.');}
  }
  async function loadDiagnostics(input={}){
    const c=context(input);announce(c);
    if(!loading)loading=(async()=>{
      const data=await read('index.json',manifest.diagnostics?.indexSha256);
      if(data?.datasetId!==manifest.datasetId||!Array.isArray(data.patternEvents)||!Array.isArray(data.clients))error('capture_hash_mismatch','Diagnostic index does not match the active dataset.');
      const q=await read(data.qualityPath,data.qualitySha256);
      if(!Array.isArray(q?.findings))error('parse_incomplete','Capture quality metadata is malformed.');
      index=data;quality=q.findings;
    })().catch(e=>{loading=null;throw e;});
    await loading;fresh(c);
    return {context:c,capabilities:copy(index.capabilities),scope:{kind:'full_capture_diagnostic_metadata',firstUs:manifest.firstUs,lastUs:Math.min(c.cutoffUs,manifest.lastUs)},limitations:limits};
  }
  function ready(){if(!index)error('evidence_unavailable','Diagnostic evidence has not been loaded.');}
  function scope(c,predicate){return {kind:'full_capture_diagnostic_metadata',requestedFirstUs:manifest.firstUs,availableFirstUs:manifest.firstUs,availableLastUs:Math.min(c.cutoffUs,manifest.lastUs),predicate,completeness:'complete_for_published_metadata_predicate'};}
  function recurrence(events,c){
    const rows=events.filter(e=>visible(e,c)&&e.reasonCode===2&&['Deauthentication','Disassociation'].includes(e.type));
    const by=new Map();
    for(const e of rows){const key=`${e.bssid}|${e.source}`;if(!by.has(key))by.set(key,[]);by.get(key).push(e);}
    const qualified=[];
    for(const [key,members]of by){members.sort((a,b)=>a.timeUs-b.timeUs||a.releaseOrdinal-b.releaseOrdinal);let left=0,peak=0;for(let right=0;right<members.length;right++){while(members[right].timeUs-members[left].timeUs>300_000_000)left++;peak=Math.max(peak,right-left+1);}if(peak>=3)qualified.push({scope:key,eventCount:members.length,peakFiveMinuteCount:peak,evidenceIds:members.map(e=>e.id),firstUs:members[0].timeUs,lastUs:members.at(-1).timeUs});}
    return {state:qualified.length?'recurrence_observed':'not_observed',eventCount:rows.length,groups:qualified,predicate:'At least 3 reason-2 termination observations for the same client/BSSID/source in an inclusive 5-minute recorded-time window. No physical interval validity implied.',ruleVersion:'recurrence-3.0',limitations:limits,context:c};
  }
  function getPattern(id,input={}){
    ready();const c=context(input),reason=id==='PAT-23'?23:id==='PAT-2'?2:null;
    if(!reason)error('evidence_unavailable','Unknown capture pattern.');
    const observations=index.patternEvents.filter(e=>e.reasonCode===reason&&visible(e,c));
    const grouped=new Map();for(const e of observations){if(!e.client)continue;if(!grouped.has(e.client))grouped.set(e.client,[]);grouped.get(e.client).push(e);}
    const memberClients=[...grouped].map(([client,rows])=>({client,count:rows.length,eventCount:rows.length,firstUs:rows[0].timeUs,lastUs:rows.at(-1).timeUs,evidenceIds:rows.map(e=>e.id),recurrence:reason===2?recurrence(rows,c):null}));
    const predicate=`All captured deauthentication/disassociation observations with reason ${reason}, admitted by the active cutoff. Client identities are globally deduplicated; this is not a shared-cause assertion.`;
    return copy({id,reasonCode:reason,title:reason===23?'Reported 802.1X failures':memberClients.some(m=>m.recurrence?.groups.length)?'Recurring authentication-state terminations':'Authentication-state terminations',failureClass:reasonMeaning(reason),cause:'Unresolved',eventCount:observations.length,count:observations.length,clientCount:memberClients.length,sourceCount:new Set(observations.map(e=>e.source)).size,sources:[...new Set(observations.map(e=>e.source))],clients:memberClients,rows:observations,evidenceIds:observations.map(e=>e.id),recurringClientCount:memberClients.filter(m=>m.recurrence?.groups.length).length,firstUs:observations[0]?.timeUs??null,lastUs:observations.at(-1)?.timeUs??null,predicate,scope:scope(c,predicate),context:c,limitations:limits});
  }
  function listPatterns(input={}){return ['PAT-23','PAT-2'].map(id=>getPattern(id,input)).filter(p=>p.eventCount);}
  function getQuality(input={}){
    ready();const c=context(input);
    return quality.flatMap(q=>{
      const admitted=o=>o[0]<=c.cutoffUs&&(c.releaseOrdinal===null||o[1]<=c.releaseOrdinal);
      if(!admitted(q.firstOccurrence))return [];
      let count=0,countExact=true;
      for(const part of q.partitions){if(admitted(part.last))count+=part.count;else if(admitted(part.first)){if(qualityParts.has(part.path))count+=qualityParts.get(part.path).filter(admitted).length;else {countExact=false;count+=1;}}}
      const evidenceIds=q.examples.filter((id,i)=>admitted(q.exampleOccurrences[i]));
      return [{id:q.id,title:q.title,description:q.detail,detail:q.detail,source:q.source,sourceIds:[q.source],kind:q.kind,count,countExact,countLabel:countExact?String(count):`At least ${count}`,discoveredAtUs:q.firstOccurrence[0],releaseOrdinal:q.firstOccurrence[1],evidenceIds,restrictions:q.prohibitedMetrics,prohibitedMetrics:q.prohibitedMetrics,ruleVersion:q.ruleVersion,context:c}];
    });
  }
  async function getQualityDetails(id,filters={},input={}){
    const c=context(input);announce(c);await loadDiagnostics(c);const q=quality.find(q=>q.id===id);
    if(!q)error('evidence_unavailable','Quality finding unavailable.');
    const admitted=o=>o[0]<=c.cutoffUs&&(c.releaseOrdinal===null||o[1]<=c.releaseOrdinal);
    const page=filters.page??0,pageSize=filters.pageSize??50;
    if(!Number.isInteger(page)||page<0||!Number.isInteger(pageSize)||pageSize<1||pageSize>500)error('invalid_filter','Invalid quality page.');
    // Only the boundary chunk and requested page chunks are fetched.
    const visibleParts=[];let total=0;
    for(const part of q.partitions){if(!admitted(part.first))continue;let count=part.count;if(!admitted(part.last)){if(!qualityParts.has(part.path)){const data=await read(part.path,part.sha256);if(data.findingId!==id||!Array.isArray(data.rows))error('parse_incomplete','Malformed quality membership.');qualityParts.set(part.path,data.rows);}count=qualityParts.get(part.path).filter(admitted).length;}visibleParts.push({part,start:total,count});total+=count;}
    const rows=[],begin=page*pageSize,end=begin+pageSize;const source=manifest.sources.find(s=>s.id===q.source);
    for(const item of visibleParts){if(item.start>=end||item.start+item.count<=begin)continue;const {part}=item;if(!qualityParts.has(part.path)){const data=await read(part.path,part.sha256);if(data.findingId!==id||!Array.isArray(data.rows))error('parse_incomplete','Malformed quality membership.');qualityParts.set(part.path,data.rows);}const members=qualityParts.get(part.path).filter(admitted).slice(Math.max(0,begin-item.start),Math.min(item.count,end-item.start));for(const tuple of members){const [timeUs,releaseOrdinal,frameNumber,fileOffset,caplen,wirelen,rate,type]=tuple;const e={id:`${q.source}-${frameNumber}`,observationId:`${source.sha256}:${frameNumber}`,source:q.source,captureHash:source.sha256,timeUs,releaseOrdinal,frameNumber,fileOffset,caplen,wirelen,rate,type,frequency:source.frequency,channel:source.channel,declaredSnaplen:q.declaredSnaplen,parseState:'quality_metadata',missingReasons:['Quality metadata projection; full frame fields not included.'],qualityFinding:id,parserVersion:'airframe-security-3.0'};frames.set(e.id,e);rows.push(e);}}
    fresh(c);return {id,rows,total,page,pageSize,nextPage:end<total?page+1:null,context:c,predicate:q.detail,restrictions:q.prohibitedMetrics};
  }
  function getInventory(input={}){
    ready();const c=context(input);const rows=index.inventory.filter(e=>e.firstUs<=c.cutoffUs&&(c.releaseOrdinal===null||e.firstOrdinal<=c.releaseOrdinal)).map(e=>({ap:e.ap,bssid:e.ap,sources:e.sources.filter(s=>{const first=e.sourceFirst?.[s];return first&&first[0]<=c.cutoffUs&&(c.releaseOrdinal===null||first[1]<=c.releaseOrdinal);}),firstUs:e.firstUs,evidenceIds:[e.firstEvidence]}));
    return {rows,observedBssidCount:rows.length,expectedInventory:'Unavailable',physicalApCount:null,stickyCandidates:getRoamingCandidates(c),stickyState:'Qualified sensor-signal leads only; sensor RSSI does not establish client roaming decisions.',limitations:['Observed BSSID aliases are not a validated physical AP inventory.','Absence from capture does not mean offline.','No authoritative expected inventory is connected.'],context:c};
  }
  function getRoamingCandidates(input={}){
    ready();const c=context(input),admitted=o=>o[0]<=c.cutoffUs&&(c.releaseOrdinal===null||o[1]<=c.releaseOrdinal),median=values=>{const v=[...values].sort((a,b)=>a-b),m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2;};
    return (index.roamingContext??[]).flatMap(item=>{
      const assoc=item.associations.filter(admitted).at(-1);if(!assoc)return [];
      const groups=new Map();for(const s of item.signals.filter(admitted)){if(!groups.has(s[2]))groups.set(s[2],[]);groups.get(s[2]).push(s);}
      const baseline=groups.get(assoc[2]);if(!baseline||baseline.length<3)return [];
      const baseSignal=median(baseline.map(s=>s[3]));const alternatives=[...groups].filter(([source,signals])=>source!==assoc[2]&&signals.length>=3).map(([source,signals])=>({source,signal:median(signals.map(s=>s[3])),signals})).filter(other=>other.signal-baseSignal>=10).sort((a,b)=>b.signal-a.signal);
      if(!alternatives.length)return [];const other=alternatives[0];
      return [{client:item.client,ap:assoc[3],associationSource:assoc[2],alternativeSource:other.source,signalDifferenceDb:other.signal-baseSignal,title:'Qualified sensor-signal comparison lead',state:'hypothesis_only',evidenceIds:[assoc[4],...baseline.slice(0,3).map(s=>s[4]),...other.signals.slice(0,3).map(s=>s[4])],predicate:'At least 3 client-transmitted signal observations per source; another sensor median is at least 10 dB stronger than the source of the latest admitted association. Whole admitted capture medians; not AP-heard RSSI or a current-serving assertion.',nextEvidence:'Request AP-heard/client-heard signal and actual roam-decision evidence before identifying a sticky client.',limitations:['Different sensors and channels do not measure the same link.','Quantized/static sensor values and unverified placement limit physical interpretation.','This rule is an investigative lead, not the report’s independently mapped candidate set.'],context:c}];
    });
  }
  async function clientRows(client,c){
    ready();const entry=index.clients.find(e=>e.client===client);
    if(!entry)error('evidence_unavailable','This client has no published diagnostic history.');
    if(!clients.has(client)){
      const data=await read(entry.path,entry.sha256);
      if(data?.client!==client||!Array.isArray(data.events))error('parse_incomplete','Client evidence is malformed.');
      for(const e of data.events){if(!Number.isSafeInteger(e.timeUs)||!e.id||!manifest.sources.some(s=>s.id===e.source&&s.sha256===e.captureHash))error('capture_hash_mismatch','Client evidence provenance does not match the active dataset.');frames.set(e.id,e);}
      clients.set(client,data.events);
    }
    fresh(c);return clients.get(client).filter(e=>visible(e,c));
  }
  function getSecurityProgression(client,events,input={}){
    const c=context(input),rows=events.filter(e=>visible(e,c)&&[e.transmitter,e.receiver,e.sourceAddress,e.destinationAddress].includes(client));
    const predicates={open_authentication:e=>e.type==='Authentication'&&e.statusCode===0&&e.authAlgorithm===0,association:e=>['Association response','Reassociation response'].includes(e.type)&&e.statusCode===0,eap:e=>e.security?.protocol==='EAP',keys:e=>e.security?.protocol==='EAPOL-Key',protected_traffic:e=>e.frameType===2&&e.protected};
    const labels={open_authentication:'Open-system authentication',association:'Association',eap:'Enterprise EAP exchange',keys:'Key establishment observations',protected_traffic:'Protected traffic indication',service:'Service verification'};
    const stages=Object.entries(predicates).map(([id,test])=>{const members=rows.filter(test);return {id,label:labels[id],state:members.length?'observed':c.mode==='capture_replay'?'not_yet_observed':'not_observed',count:members.length,evidenceIds:members.map(e=>e.id),description:id==='open_authentication'?'Open-system protocol response, not enterprise login.':id==='eap'?'Observed EAP metadata, not proof that authentication succeeded.':id==='keys'?'Key-message observations across this selected history; no automatic completed-handshake claim.':id==='protected_traffic'?'Protected traffic is not proof of successful service.':'Association alone does not establish security or service recovery.'};});
    stages.push({id:'service',label:labels.service,state:'unavailable',count:0,evidenceIds:[],description:'No application transaction or external service verification is connected.'});
    const security=rows.filter(e=>e.security?.label), counts={};for(const e of security)counts[e.security.label]=(counts[e.security.label]??0)+1;
    const m3=rows.filter(e=>e.security?.keyStage==='M3'),m2=rows.filter(e=>e.security?.keyStage==='M2');
    const contradictions=m3.filter(e=>!m2.some(p=>p.bssid===e.bssid&&p.source===e.source&&p.timeUs<=e.timeUs&&BigInt(p.security.replayCounter??'0')+1n===BigInt(e.security.replayCounter??'0'))).map(e=>({claim:'No later key progression because M2 was not captured',state:'contradicted',explanation:'M3 was observed without a matching prior-counter M2 in this selection. M2 remains not observed; identifier reuse or incomplete coverage remains possible.',evidenceIds:[e.id]}));
    const completeKeyExchanges=[];
    for(const m1 of rows.filter(e=>e.security?.keyStage==='M1'&&e.receiver===client)){
      const same=e=>e.source===m1.source&&e.bssid===m1.bssid;
      const follows=(e,prior)=>e.timeUs>=prior.timeUs&&e.releaseOrdinal>=prior.releaseOrdinal&&e.timeUs-m1.timeUs<=90_000_000;
      const second=rows.find(e=>same(e)&&e.transmitter===client&&e.security?.keyStage==='M2'&&follows(e,m1)&&e.security.replayCounter===m1.security.replayCounter);
      if(!second)continue;
      const third=rows.find(e=>same(e)&&e.receiver===client&&e.security?.keyStage==='M3'&&follows(e,second)&&BigInt(e.security.replayCounter)===BigInt(m1.security.replayCounter)+1n);
      if(!third)continue;
      const fourth=rows.find(e=>same(e)&&e.transmitter===client&&e.security?.keyStage==='M4'&&follows(e,third)&&e.security.replayCounter===third.security.replayCounter);
      if(fourth)completeKeyExchanges.push({client,bssid:m1.bssid,source:m1.source,evidenceIds:[m1.id,second.id,third.id,fourth.id],state:'four_key_messages_observed',predicate:'Same client/BSSID/source; M1/M2 replay counter equal, M3/M4 counter equal and one higher; recorded order within a 90-second matching window. No MIC verification or service claim.'});
    }
    return {client,stages,counts,contradictions,completeKeyExchanges,keyExchangeCompletion:{state:completeKeyExchanges.length?'four_key_messages_observed':'unverified',count:completeKeyExchanges.length},securityCompletion:{state:rows.some(e=>e.security?.code===3)?'eap_success_observed':'unverified',evidenceIds:rows.filter(e=>e.security?.code===3).map(e=>e.id)},service:{state:'unavailable'},scope:'Aggregate observations in the admitted selected client history; explicitly matched four-key-message sequences are listed separately and do not establish application recovery.',limitations:limits,context:c};
  }
  function analyzeRetries(events,input={}){
    const c=context(input),rows=events.filter(e=>visible(e,c)&&e.type==='Probe response');const grouped=new Map();
    for(const e of rows){const key=`${e.transmitter}|${e.source}`;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(e);}
    const groups=[...grouped].map(([key,members])=>{const retries=members.filter(e=>e.retry),initials=members.filter(e=>!e.retry);let matched=0;for(const e of retries){if(initials.some(p=>p.sequence===e.sequence&&p.fragment===e.fragment&&p.receiver===e.receiver&&p.bssid===e.bssid&&p.timeUs<=e.timeUs&&e.timeUs-p.timeUs<=1_000_000))matched++;}return {transmitter:members[0].transmitter,source:members[0].source,initialCount:initials.length,retryCount:retries.length,denominator:members.length,retryObservationPercent:members.length?100*retries.length/members.length:null,matchedRetryCount:matched,unmatchedRetryCount:retries.length-matched,evidenceIds:members.map(e=>e.id),ackVisibility:'Not paired; absent ACK is not proof of loss.'};});
    return {groups,total:rows.length,retryCount:rows.filter(e=>e.retry).length,predicate:'Probe-response observations in the selected client/time scope, grouped by transmitter and capture source. Denominator includes initial and retry observations; this is not packet-loss percentage.',matchingRule:'Candidate same-source transmitter/receiver/BSSID/sequence/fragment match within 1 recorded second; pairing is not proof of a unique logical exchange.',limitations:limits,context:c};
  }
  async function getClientHistory(client,filters={},input={}){
    const c=context(input);announce(c);await loadDiagnostics(c);const all=await clientRows(client,c);fresh(c);
    const startUs=filters.startUs??manifest.firstUs,endUs=Math.min(filters.endUs??c.cutoffUs,c.cutoffUs);
    let rows=all.filter(e=>e.timeUs>=startUs&&e.timeUs<=endUs);
    const windowRows=rows;
    if(filters.source&&filters.source!=='all')rows=rows.filter(e=>e.source===filters.source);
    if(filters.transmitter&&filters.transmitter!=='all')rows=rows.filter(e=>e.transmitter===filters.transmitter);
    if(filters.type&&filters.type!=='all')rows=rows.filter(e=>filters.type==='termination'?['Deauthentication','Disassociation'].includes(e.type):e.type===filters.type||e.security?.label===filters.type);
    if(filters.stage&&filters.stage!=='all'){const p=getSecurityProgression(client,windowRows,c).stages.find(s=>s.id===filters.stage);if(!p)error('invalid_filter','Unknown security stage.');const ids=new Set(p.evidenceIds);rows=rows.filter(e=>ids.has(e.id));}
    const page=filters.page??0,pageSize=filters.pageSize??50;
    if(!Number.isInteger(page)||page<0||!Number.isInteger(pageSize)||pageSize<1||pageSize>500)error('invalid_filter','Invalid history page.');
    const predicate='All non-beacon client-addressed or client-transmitted observations in the admitted capture, including safely minimized security metadata; then explicit window and filters. Published membership completeness does not establish capture health or complete exchange visibility.';
    const terminations=windowRows.filter(e=>['Deauthentication','Disassociation'].includes(e.type)),opening=terminations.at(-1)??null;
    const association=windowRows.filter(e=>['Association response','Reassociation response'].includes(e.type)&&e.statusCode===0&&(!opening||e.timeUs>=opening.timeUs)).at(-1)??null;
    const summary={client,title:opening?reasonMeaning(opening.reasonCode):'Client observation history',failureClass:opening?reasonMeaning(opening.reasonCode):'No reported termination in this selection',reasonCode:opening?.reasonCode??null,ap:opening?.bssid??null,cause:'Unresolved',anchors:{deauth:opening,association},firstUs:windowRows[0]?.timeUs??null,lastUs:windowRows.at(-1)?.timeUs??null,associationState:association?'observed':'not_observed',serviceState:'unavailable'};
    return copy({client,summary,rows:rows.slice(page*pageSize,(page+1)*pageSize),total:rows.length,returnedCount:rows.slice(page*pageSize,(page+1)*pageSize).length,page,pageSize,nextPage:(page+1)*pageSize<rows.length?page+1:null,firstUs:windowRows[0]?.timeUs??null,lastUs:windowRows.at(-1)?.timeUs??null,predicate,scope:{...scope(c,predicate),requestedFirstUs:startUs,requestedLastUs:filters.endUs??c.cutoffUs,availableFirstUs:Math.max(startUs,manifest.firstUs),availableLastUs:Math.min(endUs,manifest.lastUs)},securityProgression:getSecurityProgression(client,windowRows,c),recurrence:recurrence(windowRows,c),retries:analyzeRetries(windowRows,c),context:c,limitations:limits});
  }
  async function getFrameAsync(id,input={}){
    const c=context(input);announce(c);await loadDiagnostics(c);
    if(!frames.has(id)){
      const client=index.frameLookup[id];
      if(client)await clientRows(client,c);
      else {if(!/^S\d{2}-\d+$/.test(id))error('evidence_unavailable','Unknown observation.');const e=await read(`frames/${id}.json`,index.frameHashes?.[id]);if(e?.id!==id||!manifest.sources.some(s=>s.sha256===e.captureHash&&s.id===e.source))error('capture_hash_mismatch','Frame provenance is invalid.');frames.set(id,e);}
    }
    fresh(c);const e=resolvedFrame(id);if(!e)error('evidence_unavailable','Frame unavailable.');if(!visible(e,c))error('outside_replay_cutoff','This observation has not been released by replay.');return copy({...e,reasonMeaning:reasonMeaning(e.reasonCode),context:c,limitations:limits});
  }
  function getFrameCached(id,input={}){const c=context(input),e=resolvedFrame(id);if(!e)error('evidence_unavailable','Load this observation before opening it.');if(!visible(e,c))error('outside_replay_cutoff','This observation has not been released by replay.');return copy({...e,context:c,limitations:limits});}
  function prepareEvidenceRequest(client,input={}){const c=context(input);return {status:'Draft request — not sent',client,recordedWindow:{firstUs:manifest.firstUs,lastUs:Math.min(c.cutoffUs,manifest.lastUs),timezone:'UTC'},systems:['AP/controller session logs','AAA/RADIUS decisions','Client supplicant and lockout record','Application transaction verification'],fields:['Pseudonymous client mapping under authorized access','Session identifier and EAP method progression','Accept/reject/timeout decision and reported error','Certificate/trust validation and client-visible error','Successful service transaction and comparable recurrence exposure'],purpose:'Distinguish authentication/session cause from an RF contributor; association alone does not close the incident.',redaction:'Do not include raw identity, credentials or secrets in the public evidence brief.',context:c};}
  return {loadDiagnostics,listPatterns,getPattern,getQuality,getQualityDetails,getInventory,getRoamingCandidates,getClientHistory,getSecurityProgression,analyzeRetries,getFrameAsync,getFrameCached,prepareEvidenceRequest,setDiagnosticContext:input=>announce(context(input))};
}
