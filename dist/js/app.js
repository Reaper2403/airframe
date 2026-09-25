import {createService} from './service.js';
import {renderFactory} from './factory.js';
import {renderInvestigation} from './investigation.js';
import {renderAction} from './action.js';

const $=s=>document.querySelector(s);
const escape=s=>String(s??'Unavailable').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const utc=us=>new Date(us/1000).toISOString().slice(11,23);
let service,bundle,cleanup,toastTimer,lastTick=0,frameReturnFocus;
const navigationMemory=new Map();
const routeKey=()=>`${state.route}/${state.incidentId}`;
const state={route:'factory',incidentId:'AF-104',selectedFrameId:null,mode:'historical_review',cutoffUs:Infinity,generation:0,playing:false,speed:1,startUs:0,endUs:0};
const context=()=>({mode:state.mode,cutoffUs:Number.isFinite(state.cutoffUs)?state.cutoffUs:service?.manifest.lastUs,generation:state.generation});
function notify(message){$('#toast').textContent=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').textContent='',5000);}
function navigate(route,id=state.incidentId){navigationMemory.set(routeKey(),{scroll:window.scrollY,focusId:document.activeElement?.id});location.hash=route==='factory'?'factory':`${route}/${encodeURIComponent(id)}`;}
function setRange(id){let incident;try{incident=service.getIncident(id,{mode:'historical_review',cutoffUs:service.manifest.lastUs,generation:state.generation});}catch{return;}if(!incident)return;state.startUs=incident.openUs-3_000_000;state.endUs=incident.openUs+23_000_000;}
function changeMode(mode){state.playing=false;state.generation++;state.mode=mode;setRange(state.incidentId);state.cutoffUs=mode==='historical_review'?Infinity:state.startUs;state.selectedFrameId=null;closeFrame();render();}
function seek(us){state.mode='capture_replay';state.cutoffUs=Math.max(state.startUs,Math.min(state.endUs,Number(us)));state.generation++;lastTick=performance.now();if(state.selectedFrameId){try{service.getFrame(state.selectedFrameId,context());}catch{closeFrame();state.selectedFrameId=null;}}render();}
function play(){if(state.mode!=='capture_replay')changeMode('capture_replay');if(state.cutoffUs>=state.endUs)seek(state.startUs);state.playing=true;lastTick=performance.now();render();}
function pause(){state.playing=false;render();}
function replay(){return{playing:state.playing,speed:state.speed,cursorUs:Number.isFinite(state.cutoffUs)?state.cutoffUs:state.startUs,startUs:state.startUs,endUs:state.endUs,onPlay:play,onPause:pause,onSeek:seek,onSpeed:s=>{state.speed=Number(s);render();},onRestart:()=>{state.playing=false;seek(state.startUs);},onMode:changeMode};}
function render(){
 if(!service)return;
 const focused=document.activeElement;const focusId=focused?.id;const selection=typeof focused?.selectionStart==='number'?[focused.selectionStart,focused.selectionEnd]:null;
 if(typeof cleanup==='function')cleanup();
 $('#factory-nav').classList.toggle('active',state.route==='factory');$('#investigate-nav').classList.toggle('active',state.route!=='factory');
 $('#investigate-nav').href=`#investigate/${state.incidentId}`;
 $('#mode-toggle').textContent=state.mode==='historical_review'?'▷  Replay investigation':'◷  Return to historical review';
 $('#mode-caption').textContent=state.mode==='historical_review'?'Historical review':'Capture replay · recorded data';
 $('#global-replay').hidden=state.mode!=='capture_replay'||state.route==='investigate';
 $('#global-play').textContent=state.playing?'Pause':'Play';$('#global-speed').value=String(state.speed);$('#global-range').min=state.startUs;$('#global-range').max=state.endUs;$('#global-range').value=Number.isFinite(state.cutoffUs)?state.cutoffUs:state.startUs;$('#global-time').textContent=Number.isFinite(state.cutoffUs)?`${utc(state.cutoffUs)} UTC`:'Historical review';
 const ctx={service,context:context(),incidentId:state.incidentId,selectedIncidentId:state.incidentId,selectedFrameId:state.selectedFrameId,onSelect:id=>{state.incidentId=id;if(state.mode==='historical_review')setRange(id);render();},onOpen:id=>{state.incidentId=id;setRange(id);navigate('investigate',id);},onFrame:openFrame,onAction:()=>navigate('action'),onBack:()=>navigate('investigate'),onFactory:()=>navigate('factory'),notify,replay:replay()};
 try{cleanup=(state.route==='factory'?renderFactory:state.route==='action'?renderAction:renderInvestigation)($('#app'),ctx);}
 catch(error){$('#app').innerHTML=`<section class="app-error"><h1>Unable to display this investigation</h1><p>${escape(error.message)}</p><button id="recover-view">Return to Factory</button></section>`;$('#recover-view').onclick=()=>{state.incidentId='AF-104';navigate('factory');};}
 if(state.mode==='capture_replay'&&state.route==='investigate'&&!$('#app .investigation-view'))$('#global-replay').hidden=false;
 if(focusId){const next=document.getElementById(focusId);if(next){next.focus({preventScroll:true});if(selection&&next.setSelectionRange)try{next.setSelectionRange(...selection);}catch{}}}
}
function closeFrame(){const dialog=$('#frame-dialog');if(dialog.open)dialog.close();}
function openFrame(id){
 try{
  const f=service.getFrame(id,context());if(!f)throw new Error('Evidence unavailable at this replay time');
  state.selectedFrameId=id;frameReturnFocus=document.activeElement;
  const fields=[['Original frame',f.id],['Recorded UTC',new Date(f.timeUs/1000).toISOString().slice(0,19)+'.'+String(f.timeUs%1_000_000).padStart(6,'0')+' Z'],['Capture source',f.source],['Channel',f.channel],['Transmitter',f.transmitter],['Receiver',f.receiver],['BSSID context',f.bssid],['Signal',f.signal==null?'Unavailable':`${f.signal} dBm`],['Noise',f.noise==null?'Unavailable':`${f.noise} dBm`],['Retry flag',f.retry==null?'Unavailable':f.retry?'Set':'Not set'],['Reason code',f.reasonCode],['Status code',f.statusCode],['Sequence',f.sequence??f.sequenceNumber],['Original record offset',f.fileOffset??f.offset],['Parse state',f.parseState??'See manifest capabilities']];
  $('#frame-body').innerHTML=`<header><div><div class="frame-meta">HEADER EVIDENCE · ${escape(f.id)}</div><h2>${escape(f.type)}</h2></div><button class="close-dialog" id="close-frame" aria-label="Close frame details">×</button></header><dl class="frame-fields">${fields.map(([k,v])=>`<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`).join('')}</dl><p>Capture SHA-256</p><div class="frame-hash">${escape(f.captureHash)}</div><p>Source-reported headers, not proof of application recovery. Cross-source clock alignment is unverified. Original captures remain local and are not included in this site.</p>${state.mode==='capture_replay'?'<button id="seek-frame" class="frame-seek">Seek to this frame</button>':''}`;
  $('#close-frame').onclick=closeFrame;if($('#seek-frame'))$('#seek-frame').onclick=()=>{closeFrame();seek(f.timeUs);};
  if(!$('#frame-dialog').open)$('#frame-dialog').showModal();$('#close-frame').focus();
 }catch(error){notify(error.message||'Evidence unavailable');}
}
$('#frame-dialog').addEventListener('close',()=>frameReturnFocus?.isConnected&&frameReturnFocus.focus());
$('#frame-dialog').addEventListener('click',e=>{if(e.target===$('#frame-dialog'))closeFrame();});
$('#frame-dialog').addEventListener('keydown',e=>{if(e.key!=='Tab')return;const controls=[...$('#frame-dialog').querySelectorAll('button,a[href],input,select,textarea,[tabindex="0"]')].filter(n=>!n.disabled&&n.getBoundingClientRect().width);if(!controls.length)return;const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
$('#mode-toggle').onclick=()=>changeMode(state.mode==='historical_review'?'capture_replay':'historical_review');
$('#global-play').onclick=()=>state.playing?pause():play();$('#global-restart').onclick=()=>{state.playing=false;seek(state.startUs);};$('#global-range').oninput=e=>seek(e.target.value);$('#global-speed').onchange=e=>{state.speed=Number(e.target.value);render();};
window.addEventListener('hashchange',()=>{const [route,id]=location.hash.slice(1).split('/');const previousId=state.incidentId;state.route=['investigate','action'].includes(route)?route:'factory';if(id)state.incidentId=decodeURIComponent(id);if(state.incidentId!==previousId||state.route==='factory')state.selectedFrameId=null;closeFrame();if(service)setRange(state.incidentId);render();const memory=navigationMemory.get(routeKey());window.scrollTo(0,memory?.scroll||0);if(memory?.focusId)document.getElementById(memory.focusId)?.focus({preventScroll:true});});
$('.skip-link').onclick=e=>{e.preventDefault();$('#app').focus();$('#app').scrollIntoView();};
setInterval(()=>{if(!state.playing)return;const now=performance.now();state.cutoffUs=Math.min(state.endUs,state.cutoffUs+Math.round((now-lastTick)*1000*state.speed));lastTick=now;if(state.cutoffUs>=state.endUs)state.playing=false;render();},250);
async function boot(){try{const [response,indexResponse]=await Promise.all([fetch('./data-v2/bundle.json'),fetch('./data-v2/partition-manifest.json')]);if(!response.ok||!indexResponse.ok)throw new Error('The processed capture bundle is unavailable.');const bytes=await response.arrayBuffer(),index=await indexResponse.json(),partition=index.partitions?.find(p=>p.path==='bundle.json');if(!partition||bytes.byteLength!==partition.byteLength)throw new Error('Evidence integrity check failed: unexpected bundle size.');const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');if(digest!==partition.sha256)throw new Error('Evidence integrity check failed: capture bundle hash mismatch.');bundle=JSON.parse(new TextDecoder().decode(bytes));if(bundle.manifest.datasetId!==index.datasetId)throw new Error('Evidence dataset identity does not match its manifest.');service=createService(bundle);const [route,id]=location.hash.slice(1).split('/');state.route=['investigate','action'].includes(route)?route:'factory';if(id)state.incidentId=decodeURIComponent(id);setRange(state.incidentId);render();}catch(error){$('#app').innerHTML=`<section class="app-error"><h1>Capture evidence unavailable</h1><p>${escape(error.message)}</p><button id="retry-load">Retry loading</button></section>`;$('#retry-load').onclick=boot;}}
boot();
