import {escapeHTML as e, utc} from './investigation.js';

// The view contains observations and comparisons. Cause attribution belongs to review.
const states = new Map();
const PIVOTS = [['ap','AP interfaces'],['channel','Channels'],['client','Clients'],['source','Sensors']];
const number = value => value != null && Number.isFinite(Number(value)) ? Number(value).toLocaleString() : '—';
const human = value => String(value ?? '').replaceAll('_',' ');
const unique = values => [...new Set(values.filter(Boolean))];
const finite = value => typeof value === 'number' && Number.isFinite(value);
const percentage = value => finite(value) ? `${value.toFixed(value >= 10 ? 0 : 1)}%` : '—';
const valueText = (value, unit) => !finite(value) ? 'No observations' : unit === '%' ? percentage(value) : number(value);
const formatTime = value => finite(value) ? utc(value).slice(0,8) : '—';
const duration = value => value >= 60_000_000 ? `${(value/60_000_000).toFixed(1)} min` : `${(value/1_000_000).toFixed(1)} s`;
const safeJson = value => JSON.stringify(value, null, 2);
const metricList = view => Array.isArray(view.metricDefinitions) ? view.metricDefinitions : Object.values(view.metricDefinitions || {});
const metricFor = (view, id) => metricList(view).find(item => item.id === id) || metricList(view)[0] || {id,label:'Observations',unit:'observations',formula:'Recorded observations.'};
const selectedAggregate = (group, metric) => group?.metrics?.[metric] || group?.totals || {value:null,numerator:0,denominator:0};
const getFocus = state => state.focus || (state.focusClient ? {pivot:'client',id:state.focusClient} : state.focusAp ? {pivot:'ap',id:state.focusAp} : null);
const shortId = value => String(value || '').length > 28 ? `${String(value).slice(0,25)}…` : value;

// Compact deterministic identities preserve keyboard focus without copying full evidence lists.
function identifyClueControls(container) {
  const seen=new Map();
  const hash=text=>{let value=2166136261;for(let index=0;index<text.length;index++){value^=text.charCodeAt(index);value=Math.imul(value,16777619);}return (value>>>0).toString(36);};
  container.querySelectorAll('button,input,select,textarea,summary,[tabindex]').forEach((element,index)=>{
    if(element.id)return;
    const entries=Object.entries(element.dataset||{}),kind=(entries[0]?.[0]||element.tagName.toLowerCase()).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,28);
    const identity=entries.map(([key,value])=>`${key}:${value}`).join('|')||element.name||element.getAttribute('aria-label')||`${element.tagName}:${index}`;
    const base=`cw-${kind}-${hash(identity)}`,occurrence=seen.get(base)||0;seen.set(base,occurrence+1);element.id=`${base}-${occurrence}`;
  });
}

function initialState(ctx) {
  const scope = ctx.initialClueScope || {};
  const key = `${ctx.incidentId || 'capture'}:${JSON.stringify(scope)}`;
  if (!states.has(key)) states.set(key, {
    pivot:scope.focus?.pivot || (scope.focusClient ? 'client' : 'ap'),metric:'terminations',binCount:24,startUs:null,endUs:null,
    focus:scope.focus || null,focusAp:scope.focusAp || null,focusClient:scope.focusClient || null,
    rowOrder:'activity',selectedCell:null,selectedClue:null,search:'',notes:'',showAllClues:false,cohortSort:'join',cohortDirection:1,cohortFilter:'associated',cohortPage:0,cohortFocusOnly:false,cohortReason:null,cohortPeerClient:null,selectedClient:null,attemptIndex:0,attemptPage:0,lastReport:null,
  });
  return states.get(key);
}
function queryFor(state) {
  const focus = getFocus(state);
  return {
    pivot:state.pivot,metric:state.metric,binCount:state.binCount,
    ...(finite(state.startUs) ? {startUs:state.startUs} : {}),
    ...(finite(state.endUs) ? {endUs:state.endUs} : {}),
    ...(focus ? {focus, ...(focus.pivot === 'ap' ? {focusAp:focus.id} : focus.pivot === 'client' ? {focusClient:focus.id} : {})} : {}),
  };
}
function aggregateCaption(aggregate, definition) {
  if (!aggregate || aggregate.state === 'unavailable' || !finite(aggregate.value)) return 'No admitted observations';
  return definition.unit === '%'
    ? `${number(aggregate.numerator)} / ${number(aggregate.denominator)} eligible observations`
    : `${number(aggregate.clients ?? aggregate.clientCount ?? 0)} client aliases observed · ${number(aggregate.observations ?? aggregate.denominator ?? aggregate.numerator)} observations`;
}
function heatColor(value, maximum) {
  if (!finite(value)) return '';
  if (value === 0) return '#17252f';
  const t = Math.min(1, Math.sqrt(value / Math.max(maximum,1)));
  const low=[37,80,107], high=[173,221,249];
  return `rgb(${low.map((v,i)=>Math.round(v+(high[i]-v)*t)).join(',')})`;
}
function lineSvg(values, options={}) {
  const points = values || [];
  const width=600,height=83,left=5,right=5,top=10,bottom=13;
  const max=Math.max(1,...points.map(point=>finite(point.value)?point.value:0));
  const x=index=>left+(points.length<2 ? 0 : index/(points.length-1))*(width-left-right);
  const y=value=>height-bottom-(value/max)*(height-top-bottom);
  let runs=[],run=[];
  points.forEach((point,index)=>{if(finite(point.value))run.push([x(index),y(point.value)]);else if(run.length){runs.push(run);run=[];}});
  if(run.length)runs.push(run);
  const paths=runs.map(points=>`<path d="${points.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')}"/>`).join('');
  const noData=points.map((point,index)=>!finite(point.value)?`<rect x="${Math.max(0,x(index)-(width/Math.max(points.length,1))/2)}" y="0" width="${width/Math.max(points.length,1)}" height="${height}" fill="url(#cw-trend-missing)"/>`:'').join('');
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${e(options.label || 'Recorded trend')}. ${points.filter(point=>finite(point.value)).length} observed bins; ${points.filter(point=>!finite(point.value)).length} bins without observations."><defs><pattern id="cw-trend-missing" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0,7L7,0" stroke="#35434b" stroke-width="1"/></pattern></defs>${noData}<line x1="0" y1="${height-bottom}" x2="${width}" y2="${height-bottom}" class="cw-chart-axis"/><line x1="0" y1="${top}" x2="${width}" y2="${top}" class="cw-chart-guide"/><g class="cw-chart-line" style="stroke:${options.color||'#8fcfff'}">${paths}${runs.filter(points=>points.length===1).map(points=>`<circle cx="${points[0][0]}" cy="${points[0][1]}" r="2" fill="currentColor"/>`).join('')}</g></svg>`;
}
function frameButtons(ids, label='Inspect source evidence') {
  return ids?.length ? `<button type="button" class="cw-text-button" data-clue-evidence="${e(ids.join(','))}">${e(label)} <span aria-hidden="true">↗</span></button>` : '<span class="cw-muted">No matching source records</span>';
}
function empty(title, text, action='') {
  return `<div class="cw-empty"><span aria-hidden="true">◌</span><h3>${e(title)}</h3><p>${e(text)}</p>${action}</div>`;
}

export function renderClueWorkspace(container, ctx) {
  const state=initialState(ctx), service=ctx.clueService;
  const mountFocus=container.contains(document.activeElement)?{id:document.activeElement.id,selectionStart:document.activeElement.selectionStart}:null;
  let alive=true,generation=0,view=null,activeEvidence=null,detailGeneration=0,reportController=null;
  const active=()=>alive&&container.isConnected;
  const notify=message=>ctx.notify?.(message);
  const root=document.createElement('div');root.className='clue-workspace investigation-view';
  container.replaceChildren(root);
  const captureStart=Number(ctx.service?.manifest?.firstUs || ctx.replay?.startUs || 0);
  const captureEnd=Number(ctx.service?.manifest?.lastUs || ctx.replay?.endUs || captureStart+1);
  const admittedEnd=()=>ctx.context.mode==='capture_replay' ? Math.min(captureEnd,ctx.context.cutoffUs) : captureEnd;
  const drawLoading=()=>{root.innerHTML=`<div class="cw-loading" role="status"><span class="cw-loading-mark" aria-hidden="true"></span><h1>Opening the clue workspace</h1><p>Joining recorded observations across AP interfaces, channels and clients…</p></div>`;};
  function drawError(error) {
    root.innerHTML=`<div class="cw-error" role="alert"><span class="cw-overline">EVIDENCE UNAVAILABLE</span><h1>This comparison could not be loaded</h1><p>${e(error?.message || 'The evidence service did not respond.')}</p><p class="cw-muted">A loading error does not establish network health.</p><button type="button" class="btn btn-primary" data-clue-retry>Retry comparison</button><button type="button" class="cw-text-button" data-clue-factory>Return to Factory</button></div>`;
    root.querySelector('[data-clue-retry]').onclick=load;
    root.querySelector('[data-clue-factory]').onclick=ctx.onFactory;
  }
  async function load() {
    const request=++generation;drawLoading();
    try {if(!service?.load||!service?.getView)throw Error('The comparison evidence service is unavailable.');await service.load(ctx.context);if(!active()||request!==generation)return;draw();}
    catch(error){if(active()&&request===generation)drawError(error);}
  }
  function refresh({keepCell=false,keepClue=false}={}) {
    if(!keepCell)state.selectedCell=null;
    if(!keepClue)state.selectedClue=null;
    draw();
  }
  function draw() {
    if(!active())return;
    if(finite(state.startUs)&&state.startUs>admittedEnd()){state.startUs=null;state.endUs=null;state.selectedCell=null;notify('The selected window is beyond the replay cursor. Showing admitted observations.');}
    const focused=root.contains(document.activeElement) ? document.activeElement?.id : mountFocus?.id;
    const selectionStart=root.contains(document.activeElement)?document.activeElement?.selectionStart:mountFocus?.selectionStart;
    try {view=service.getView(queryFor(state),ctx.context);}catch(error){drawError(error);return;}
    const definition=metricFor(view,state.metric);
    const selectedClue=(view.clues||[]).find(clue=>clue.id===state.selectedClue);
    const clueIds=new Set(selectedClue?.evidenceIds||[]);
    const affectedKey={ap:'aps',channel:'channels',client:'clients',source:'sources'}[state.pivot];
    const affectedRows=new Set((selectedClue?.affected?.[affectedKey]||[]).map(String));
    const window=view.window || {};
    const start=Number(window.startUs ?? view.query?.startUs ?? state.startUs ?? captureStart);
    const end=Number(window.endUs ?? view.query?.endUs ?? state.endUs ?? admittedEnd());
    const focus=getFocus(state);
    const bins=view.matrix?.bins || [];
    const allRows=[...(view.matrix?.rows || [])];
    const visibleRows=allRows.filter(row=>!state.search||`${row.label} ${row.id}`.toLowerCase().includes(state.search.toLowerCase()));
    visibleRows.sort((a,b)=>Number(b.focus)-Number(a.focus)||(state.rowOrder==='name'?String(a.label).localeCompare(String(b.label)):Number(b.totals?.value || 0)-Number(a.totals?.value || 0)));
    const max=finite(view.matrix?.maxValue)?view.matrix.maxValue:null;
    const global=view.comparison?.global || {};
    const total=selectedAggregate(global,state.metric);
    const selectedRow=allRows.find(row=>row.id===state.selectedCell?.rowId);
    const selectedCell=selectedRow?.cells.find((cell,index)=>(cell.index??index)===state.selectedCell?.index);
    const availableMetrics=metricList(view);
    let attemptResult=null;
    if(state.selectedClient&&service.getClientAttempts){try{attemptResult=service.getClientAttempts(state.selectedClient,{...queryFor(state),attemptPage:state.attemptPage||0,attemptPageSize:20},ctx.context);}catch(error){attemptResult={attempts:[],total:0,limitations:[error.message]};}}
    const replay=ctx.context.mode==='capture_replay';
    const qualityCount=(view.coverage?.qualityFindings || []).length;
    root.innerHTML=`
      <header class="cw-heading">
        <div><div class="cw-breadcrumb"><button type="button" data-clue-factory>Factory</button><span aria-hidden="true">/</span><span>Investigation</span></div><div class="cw-title-row"><h1>Follow the clues</h1><span class="cw-live-state"><i></i>${replay?'Recorded replay':'Historical review'}</span></div><p>Compare when, where and who. Build an explanation from the evidence.</p></div>
        <div class="cw-heading-actions"><button type="button" class="cw-text-button" data-clue-original-brief>Original action brief <span aria-hidden="true">↗</span></button><button type="button" class="btn btn-primary" data-clue-export-open>AI incident report <span aria-hidden="true">→</span></button></div>
      </header>
      <section class="cw-scope" aria-label="Shared comparison scope">
        <div class="cw-scope-context"><span class="cw-overline">COMPARE ACROSS THE CAPTURE</span><div><strong>${focus?e(shortId(focus.id)):'All observed entities'}</strong>${focus?`<span class="cw-focus-kind">${e(PIVOTS.find(([key])=>key===focus.pivot)?.[1]||'Focus')}</span><button type="button" class="cw-clear" data-clue-clear-focus aria-label="Clear focus and compare all entities">×</button>`:''}</div><p>${focus?focus.pivot===state.pivot?'Focus highlighted · other entities remain visible':'Focus kept for comparisons · matrix shows another grouping':'Select a row to compare it with the rest'}</p></div>
        <div class="cw-scope-stat"><strong>${number(global.clientCount ?? view.globalSummary?.clientCount ?? 0)}</strong><span>aliases in observations · whole window</span><small>${number(global.associatedClientCount??view.globalSummary?.associatedClientCount)} with successful association</small></div>
        <div class="cw-scope-stat"><strong>${valueText(total.value,definition.unit)}</strong><span>${e(definition.label.toLowerCase())} · whole window</span></div>
        <button type="button" class="cw-coverage-trigger" data-clue-coverage><span class="cw-coverage-dot"></span><span><strong>Measurement coverage</strong><small>${qualityCount?`${qualityCount} validity findings`:'Limits apply'} · inspect what's missing</small></span><span aria-hidden="true">↗</span></button>
      </section>
      <section class="cw-window" aria-label="Linked time window">
        <div class="cw-window-title"><span class="cw-overline">SHARED TIME WINDOW · UTC</span><strong>${formatTime(start)} <span>—</span> ${formatTime(end)}</strong><small>${duration(Math.max(0,end-start))} selected${replay?' · admitted up to replay cursor':''}</small></div>
        <div class="cw-range-controls"><label>From <time data-clue-start-label>${formatTime(start)}</time><input id="cw-window-start" data-clue-window-start type="range" min="0" max="${Math.max(0,admittedEnd()-captureStart)}" step="1000000" value="${Math.max(0,start-captureStart)}" aria-label="Window start, microseconds since first capture" aria-valuetext="${formatTime(start)} UTC"></label><label>To <time data-clue-end-label>${formatTime(end)}</time><input id="cw-window-end" data-clue-window-end type="range" min="0" max="${Math.max(0,admittedEnd()-captureStart)}" step="1000000" value="${Math.max(0,end-captureStart)}" aria-label="Window end, microseconds since first capture" aria-valuetext="${formatTime(end)} UTC"></label></div>
        <div class="cw-window-presets"><button type="button" data-clue-window-preset="all">All recorded</button><button type="button" data-clue-window-preset="last">Last 5 min</button><button type="button" data-clue-window-preset="entry">Around entry</button></div>
      </section>
      <div class="cw-body"><div class="cw-analysis">
        <section class="cw-panel cw-matrix-panel" aria-labelledby="cw-matrix-title">
          <header class="cw-section-heading"><div><span class="cw-overline">01 · FIND THE SHAPE</span><h2 id="cw-matrix-title">Where and when does it repeat?</h2></div><span class="cw-recording-badge">Recorded observations</span></header>
          <div class="cw-matrix-toolbar"><div class="cw-segment" role="group" aria-label="Group matrix rows">${PIVOTS.map(([id,label])=>`<button type="button" data-clue-pivot="${id}" aria-pressed="${state.pivot===id}" class="${state.pivot===id?'is-active':''}">${label}</button>`).join('')}</div><label class="cw-field">Show<select id="cw-metric" data-clue-metric aria-label="Heatmap measurement">${availableMetrics.map(item=>`<option value="${e(item.id)}" ${item.id===state.metric?'selected':''}>${e(item.label)}${item.unit==='%'?' (%)':''}</option>`).join('')}</select></label></div>
          <div class="cw-matrix-subtools"><p id="cw-metric-definition">${e(definition.formula || definition.description || 'Source-recorded observations in each interval.')}</p><div><label class="cw-search"><span class="sr-only">Find a matrix row</span><input id="cw-row-search" type="search" data-clue-search placeholder="Find an entity…" value="${e(state.search)}"></label><label class="sr-only" for="cw-row-order">Sort matrix rows</label><select id="cw-row-order" data-clue-order aria-label="Sort matrix rows"><option value="activity" ${state.rowOrder==='activity'?'selected':''}>Pinned focus, then value</option><option value="name" ${state.rowOrder==='name'?'selected':''}>Pinned focus, then name</option></select></div></div>
          ${visibleRows.length&&bins.length?`<div class="cw-matrix-scroll" tabindex="0" role="region" aria-label="Entity by time matrix. Arrow keys move between cells. Scroll to see more rows."><div class="cw-matrix" style="--cw-bin-count:${bins.length}" role="grid" aria-label="${e(definition.label)} by ${e(state.pivot)} and recorded time" aria-rowcount="${visibleRows.length+1}" aria-colcount="${bins.length+2}" aria-describedby="cw-metric-definition"><div class="cw-matrix-axis" role="row"><span role="columnheader">${e(PIVOTS.find(([id])=>id===state.pivot)?.[1])} <small>${number(visibleRows.length)} / ${number(allRows.length)}</small></span><div class="cw-matrix-ticks" role="presentation">${bins.map((bin,index)=>`<span role="columnheader" title="${formatTime(bin.startUs)}–${formatTime(bin.endUs)} UTC">${index===0||index===bins.length-1||index%Math.max(1,Math.floor(bins.length/5))===0?formatTime(bin.startUs).slice(0,5):'<span class="sr-only">'+formatTime(bin.startUs)+'</span>'}</span>`).join('')}</div><span role="columnheader">Window value</span></div>${visibleRows.map((row,rowIndex)=>`<div class="cw-matrix-row ${row.focus?'is-focused':''} ${affectedRows.has(String(row.id))?'is-clue-related':''}" role="row"><div role="rowheader"><button type="button" class="cw-row-label" data-clue-focus-row="${e(row.id)}" title="Compare ${e(row.label)} with the rest" aria-pressed="${!!row.focus}"><span>${e(row.label)}${state.pivot==='ap'&&row.channels?.length?`<em>ch ${row.channels.map(e).join(', ')}</em>`:''}</span>${row.focus?'<small>PINNED</small>':''}</button></div><div class="cw-matrix-cells" role="presentation">${row.cells.map((cell,index)=>{const selected=state.selectedCell?.rowId===row.id&&state.selectedCell?.index===(cell.index??index);const denominator=definition.unit==='%'?`${number(cell.numerator)} of ${number(cell.denominator)} ${definition.denominator||'observations'}`:`${number(cell.numerator)} matches in ${number(cell.observations??cell.denominator)} admitted observations`;return `<button type="button" role="gridcell" class="cw-cell ${!finite(cell.value)?'is-unknown':''} ${selected?'is-selected':''} ${selectedClue&&(cell.evidenceIds||[]).some(id=>clueIds.has(id))?'has-clue':''}" data-clue-cell="${e(row.id)}" data-clue-bin="${cell.index??index}" data-clue-row-position="${rowIndex}" data-clue-cell-position="${index}" tabindex="${selected||(!state.selectedCell&&rowIndex===0&&index===0)?0:-1}" aria-selected="${selected}" aria-label="${e(row.label)}. ${formatTime(cell.startUs)} to ${formatTime(cell.endUs)} UTC. ${e(definition.label)}: ${valueText(cell.value,definition.unit)}. ${finite(cell.value)?e(denominator):'No admitted observations; not a zero.'}" title="${e(row.label)} · ${formatTime(cell.startUs)}–${formatTime(cell.endUs)}\n${valueText(cell.value,definition.unit)} · ${finite(cell.value)?e(denominator):'Unknown'}" ${finite(cell.value)?`style="background:${heatColor(cell.value,max)}"`:''}><span class="sr-only">${valueText(cell.value,definition.unit)}</span></button>`;}).join('')}</div><span class="cw-row-total" role="gridcell">${valueText(row.totals?.value,definition.unit)}<small>${definition.unit==='%'?`${number(row.totals?.numerator)} / ${number(row.totals?.denominator)}`:`${number(row.associatedClientCount??row.totals?.associatedClients)} associated · ${number(row.totals?.clients??0)} aliases`}</small></span></div>`).join('')}</div></div>`:empty(state.search?'No matching entities':'No observations in this window',state.search?'Clear the search or choose another grouping.':'Expand the time window. Missing evidence is not a healthy state.')}
          ${selectedClue?`<div class="cw-selected-clue"><span><i></i>Clue highlighted · ${e(selectedClue.title)}</span><button type="button" data-clue-clear-highlight>Clear ×</button></div>`:''}<div class="cw-matrix-footer"><div class="cw-heat-legend"><span class="cw-swatch-zero"></span><span>0</span><span class="cw-gradient"></span><span>${valueText(max,definition.unit)}</span><span class="cw-swatch-unknown"></span><span>No observations</span></div><p>Colour shows quantity, not cause. ${state.pivot==='ap'?'AP interface = observed BSSID.':state.pivot==='source'?'Sensor rows describe captures, not sensor health.':''}</p></div>
          ${selectedCell?`<div class="cw-cell-detail" aria-live="polite"><div><span class="cw-overline">SELECTED INTERVAL</span><h3>${e(selectedRow.label)} <span>${formatTime(selectedCell.startUs)}–${formatTime(selectedCell.endUs)} UTC</span></h3><p><strong>${valueText(selectedCell.value,definition.unit)}</strong> ${e(definition.label.toLowerCase())} · ${definition.unit==='%'?`${number(selectedCell.numerator)} / ${number(selectedCell.denominator)} eligible observations`:`${number(selectedCell.numerator)} matching records · ${number(selectedCell.observations)} admitted observations`}</p></div><div>${frameButtons(selectedCell.evidenceIds,'Inspect matching records')}<button type="button" class="cw-text-button" data-clue-zoom-cell>Use this time window →</button></div></div>`:'<div class="cw-matrix-hint"><span aria-hidden="true">⌖</span> Select an interval to inspect its sample and source records. Select a row to compare peers.</div>'}
        </section>
        <section class="cw-panel cw-trends-panel" aria-labelledby="cw-trends-title"><header class="cw-section-heading"><div><span class="cw-overline">02 · COMPARE THE CONTEXT</span><h2 id="cw-trends-title">What changes alongside it?</h2></div><span class="cw-small-label">Same selected window<br>Independent scales · compare timing, not heights</span></header><div class="cw-context-grid"><div class="cw-trend-stack">${renderTrends(view,start,end,state.metric)}<details class="cw-small-details"><summary>Inspect trend values</summary>${trendTable(view)}</details></div><div class="cw-peer-panel">${renderComparison(view,definition,state.metric)}</div></div></section>
        ${renderReasonTransitions(view)}
        ${renderCohorts(view,state)}
        ${state.selectedClient?renderAttemptPanel(attemptResult,state,view):''}
        <section class="cw-panel cw-progress-panel" aria-labelledby="cw-progress-title"><header class="cw-section-heading"><div><span class="cw-overline">CONNECTION PROGRESS</span><h2 id="cw-progress-title">Where does progress stop?</h2></div><span class="cw-small-label">${e(view.comparison?.focus?.label||'All published observations')}<br>Stage coverage, not a completion funnel</span></header><div class="cw-stage-track">${(view.stages||[]).map((stage,index)=>`<div class="cw-stage ${['unavailable','unknown','no_observations'].includes(stage.state)?'is-unavailable':''}"><span class="cw-stage-index">${String(index+1).padStart(2,'0')}</span><h3>${e(stage.label)}</h3><strong>${['unavailable','unknown','no_observations'].includes(stage.state)?'—':number(stage.clients??stage.count)}</strong><span>${['unavailable','unknown','no_observations'].includes(stage.state)?(stage.state==='no_observations'?'No observations':'Not measurable'):'clients observed'}</span><p>${e(stage.description||human(stage.state))}</p>${frameButtons(stage.evidenceIds,'Records')}</div>`).join('')||empty('Stage coverage unavailable','This source does not provide connection-stage measurements.')}</div><p class="cw-panel-note">Joining or protected traffic does not establish that the operator’s task recovered.</p></section>
        ${renderProtocolSummary(view)}
        ${renderComposition(view)}<footer class="cw-footnote"><span aria-hidden="true">ⓘ</span><span>Recorded timestamps. Cross-source clock alignment and capture completeness are unverified. Explore measurements even when no clue is detected.</span></footer>
      </div>
      <aside class="cw-clue-rail" aria-labelledby="cw-clues-title"><div class="cw-clues-heading"><span class="cw-overline">PATTERNS TO EXAMINE</span><h2 id="cw-clues-title">Clues <span>${number(view.clues?.length||0)}</span></h2><p>Across the selected window. Causes remain open.</p></div><div class="cw-clue-list">${renderClues(view,state)}</div><section class="cw-next-evidence"><span class="cw-overline">KEEP THE BLIND SPOTS VISIBLE</span><h3>What this capture cannot tell us</h3><div class="cw-missing-tags">${(view.coverage?.capabilities||[]).filter(item=>['unavailable','unknown','unsupported','not_observed'].includes(item.state)).slice(0,5).map(item=>`<span>${e(item.label)}</span>`).join('')||'<span>Physical cause</span><span>Application outcome</span>'}</div><button type="button" class="cw-text-button" data-clue-coverage>Review coverage <span aria-hidden="true">↗</span></button></section><section class="cw-handoff"><span class="cw-overline">NEXT · AI REVIEW</span><h3>Turn the clues into an incident report</h3><p>Generate a scoped assessment with supporting evidence, open questions and a one-page PDF.</p><button type="button" class="btn" data-clue-export-open>Prepare incident report →</button><small>You choose when to send the evidence.</small></section></aside></div>`;
    bind({start,end,allRows,selectedCell,selectedRow,definition,attemptResult});
    identifyClueControls(root);
    if(focused){const next=document.getElementById(focused);if(next&&root.contains(next)){next.focus({preventScroll:true});if(typeof selectionStart==='number'&&next.setSelectionRange)try{next.setSelectionRange(selectionStart,selectionStart);}catch{}}}
  }
  function bind({start,end,allRows,selectedCell,definition,attemptResult}) {
    root.querySelectorAll('[data-clue-factory]').forEach(button=>button.onclick=ctx.onFactory);
    root.querySelector('[data-clue-original-brief]').onclick=ctx.onAction;
    root.querySelector('[data-clue-clear-focus]')?.addEventListener('click',()=>{state.focus=null;state.focusAp=null;state.focusClient=null;refresh();});
    root.querySelectorAll('[data-clue-pivot]').forEach(button=>button.onclick=()=>{state.pivot=button.dataset.cluePivot;state.search='';refresh();});
    root.querySelector('[data-clue-metric]').onchange=event=>{state.metric=event.target.value;refresh();};
    root.querySelector('[data-clue-order]').onchange=event=>{state.rowOrder=event.target.value;refresh({keepCell:true,keepClue:true});};
    root.querySelector('[data-clue-search]').oninput=event=>{state.search=event.target.value;refresh({keepCell:true,keepClue:true});};
    root.querySelectorAll('[data-clue-focus-row]').forEach(button=>button.onclick=()=>{state.focus={pivot:state.pivot,id:button.dataset.clueFocusRow};state.focusAp=null;state.focusClient=null;refresh();});
    root.querySelectorAll('[data-clue-cell]').forEach(button=>{
      button.onclick=()=>{state.selectedCell={rowId:button.dataset.clueCell,index:Number(button.dataset.clueBin)};refresh({keepCell:true,keepClue:true});};
      button.onkeydown=event=>{
        const row=Number(button.dataset.clueRowPosition),column=Number(button.dataset.clueCellPosition);
        let targetRow=row,targetColumn=column;
        if(event.key==='ArrowLeft')targetColumn--;
        else if(event.key==='ArrowRight')targetColumn++;
        else if(event.key==='ArrowUp')targetRow--;
        else if(event.key==='ArrowDown')targetRow++;
        else if(event.key==='Home')targetColumn=0;
        else if(event.key==='End')targetColumn=(view.matrix?.bins?.length||1)-1;
        else return;
        event.preventDefault();
        const target=root.querySelector(`[data-clue-row-position="${targetRow}"][data-clue-cell-position="${targetColumn}"]`);
        if(target){root.querySelectorAll('[data-clue-cell]').forEach(cell=>cell.tabIndex=-1);target.tabIndex=0;target.focus();}
      };
    });
    root.querySelector('[data-clue-zoom-cell]')?.addEventListener('click',()=>{state.startUs=selectedCell.startUs;state.endUs=selectedCell.endUs;refresh();});
    for(const key of ['start','end']) {
      const input=root.querySelector(`[data-clue-window-${key}]`);
      input.oninput=event=>{const value=captureStart+Number(event.target.value);root.querySelector(`[data-clue-${key}-label]`).textContent=formatTime(value);event.target.setAttribute('aria-valuetext',`${formatTime(value)} UTC`);};
      input.onchange=event=>{
        const value=captureStart+Number(event.target.value);
        const minimum=Math.min(1_000_000,Math.max(1,admittedEnd()-captureStart));
        if(key==='start'){state.startUs=Math.max(captureStart,Math.min(value,end-minimum));state.endUs=end;}
        else{state.startUs=start;state.endUs=Math.min(admittedEnd(),Math.max(value,start+minimum));}
        refresh();
      };
    }
    root.querySelectorAll('[data-clue-window-preset]').forEach(button=>button.onclick=()=>{
      if(button.dataset.clueWindowPreset==='all'){state.startUs=null;state.endUs=null;}
      else if(button.dataset.clueWindowPreset==='last'){state.startUs=Math.max(captureStart,admittedEnd()-300_000_000);state.endUs=admittedEnd();}
      else{let incident;try{incident=ctx.service.getIncident(ctx.incidentId,ctx.context);}catch{}const anchor=incident?.openUs??start;state.startUs=Math.max(captureStart,anchor-60_000_000);state.endUs=Math.min(admittedEnd(),anchor+120_000_000);if(state.startUs>=state.endUs){state.startUs=null;state.endUs=null;}}
      refresh();
    });
    root.querySelector('[data-clue-clear-highlight]')?.addEventListener('click',()=>{state.selectedClue=null;refresh({keepCell:true});});
    root.querySelector('[data-clue-more]')?.addEventListener('click',()=>{state.showAllClues=!state.showAllClues;refresh({keepCell:true,keepClue:true});});
    root.querySelectorAll('[data-clue-open]').forEach(button=>button.onclick=()=>{state.selectedClue=state.selectedClue===button.dataset.clueOpen?null:button.dataset.clueOpen;refresh({keepCell:true,keepClue:true});});
    root.querySelectorAll('[data-clue-coverage]').forEach(button=>button.onclick=showCoverage);
    root.querySelectorAll('[data-clue-export-open]').forEach(button=>button.onclick=showExport);
    root.querySelector('[data-clue-cohort-reason]')?.addEventListener('change',event=>{state.cohortReason=event.target.value;state.cohortPage=0;refresh({keepCell:true,keepClue:true});});
    root.querySelector('[data-clue-clear-peer]')?.addEventListener('click',()=>{state.cohortPeerClient=null;state.cohortPage=0;refresh({keepCell:true,keepClue:true});});
    root.querySelector('[data-clue-same-interface]')?.addEventListener('click',()=>{state.cohortPeerClient=state.selectedClient;state.cohortFocusOnly=false;state.cohortFilter='associated';state.cohortPage=0;refresh({keepCell:true,keepClue:true});root.querySelector('.cw-cohort-panel')?.scrollIntoView({block:'start',behavior:'smooth'});});
    root.querySelector('[data-clue-cohort-filter]')?.addEventListener('change',event=>{state.cohortFilter=event.target.value;state.cohortPage=0;refresh({keepCell:true,keepClue:true});});
    root.querySelector('[data-clue-cohort-focus]')?.addEventListener('change',event=>{state.cohortFocusOnly=event.target.checked;state.cohortPage=0;refresh({keepCell:true,keepClue:true});});
    root.querySelectorAll('[data-clue-cohort-sort]').forEach(button=>button.onclick=()=>{const key=button.dataset.clueCohortSort;state.cohortDirection=state.cohortSort===key?-state.cohortDirection:1;state.cohortSort=key;state.cohortPage=0;refresh({keepCell:true,keepClue:true});});
    root.querySelectorAll('[data-clue-cohort-page]').forEach(button=>button.onclick=()=>{state.cohortPage+=Number(button.dataset.clueCohortPage);refresh({keepCell:true,keepClue:true});});
    root.querySelectorAll('[data-clue-client-attempts]').forEach(button=>button.onclick=()=>{state.selectedClient=button.dataset.clueClientAttempts;state.attemptIndex=0;state.attemptPage=0;refresh({keepCell:true,keepClue:true});root.querySelector('[data-clue-attempt-panel]')?.scrollIntoView({block:'start',behavior:'smooth'});});
    root.querySelector('[data-clue-close-attempt]')?.addEventListener('click',()=>{state.selectedClient=null;refresh({keepCell:true,keepClue:true});});
    root.querySelector('[data-clue-attempt-page]')?.addEventListener('change',event=>{state.attemptPage=Number(event.target.value);state.attemptIndex=0;refresh({keepCell:true,keepClue:true});});
    root.querySelector('[data-clue-attempt-index]')?.addEventListener('change',event=>{state.attemptIndex=Number(event.target.value);refresh({keepCell:true,keepClue:true});});
    root.querySelectorAll('[data-clue-attempt-direction]').forEach(button=>button.onclick=()=>{const next=state.attemptIndex+Number(button.dataset.clueAttemptDirection);if(next<0){state.attemptPage=Math.max(0,(attemptResult?.page||0)-1);state.attemptIndex=(attemptResult?.pageSize||20)-1;}else if(next>=(attemptResult?.attempts?.length||0)){state.attemptPage=attemptResult?.nextPage??state.attemptPage;state.attemptIndex=0;}else state.attemptIndex=next;refresh({keepCell:true,keepClue:true});});
    root.querySelectorAll('[data-clue-attempt-frame]').forEach(button=>button.onclick=()=>ctx.onFrame(button.dataset.clueAttemptFrame,null,(attemptResult?.attempts?.[state.attemptIndex]?.events||[]).map(event=>event.id)));

    bindEvidence(root);
  }
  function bindEvidence(host) {
    host.querySelectorAll('[data-clue-evidence]').forEach(button=>button.onclick=()=>showEvidence(unique(button.dataset.clueEvidence.split(',')),0));
  }
  function showDialog(title,markup,after) {
    detailGeneration++;
    reportController?.abort();reportController=null;
    ctx.onBeforeDetail?.();
    const dialog=document.getElementById('frame-dialog'),body=document.getElementById('frame-body');
    if(!dialog||!body){notify('The detail viewer is unavailable.');return;}
    const previous=document.activeElement;
    body.innerHTML=`<div class="cw-detail"><header><div><span class="cw-overline">AIRFRAME · RECORDED EVIDENCE</span><h2>${e(title)}</h2></div><button type="button" class="close-dialog" aria-label="Close diagnostic details">×</button></header>${markup}</div>`;
    body.querySelector('.close-dialog').onclick=()=>dialog.close();
    bindEvidence(body);after?.(body);
    if(!dialog.open)dialog.showModal();
    body.querySelector('.close-dialog').focus();
    dialog.addEventListener('close',()=>{detailGeneration++;reportController?.abort();reportController=null;if(previous?.isConnected)previous.focus({preventScroll:true});},{once:true});
  }
  function showEvidence(ids,page=0) {
    activeEvidence=ids;
    let result;
    try{result=service.inspectEvidence(ids,ctx.context);}catch(error){showDialog('Evidence unavailable',`<p>${e(error.message)}</p>`);return;}
    if(result&&typeof result.then==='function'){showDialog('Loading source records','<p role="status">Loading exact membership…</p>');const current=ids;result.then(loaded=>{if(active()&&activeEvidence===current)renderEvidence(loaded,ids,page);}).catch(error=>{if(active())showDialog('Evidence unavailable',`<p>${e(error.message)}</p>`);});return;}
    renderEvidence(result,ids,page);
  }
  function renderEvidence(result,ids,page) {
    const rows=Array.isArray(result)?result:result?.rows||[];
    const pageSize=20,total=rows.length;
    const shown=rows.slice(page*pageSize,(page+1)*pageSize);
    showDialog('Source evidence',`<p class="cw-detail-intro">${number(result?.total??total)} matching records. Membership is tied to the selected measurement and recorded time window.</p><div class="cw-detail-table"><table><thead><tr><th>Record</th><th>UTC / source</th><th>Client / interface</th><th>Parsed observation</th></tr></thead><tbody>${shown.map(row=>`<tr><td><button type="button" class="cw-text-button mono" data-clue-source-frame="${e(row.id)}">${e(row.id)} ↗</button></td><td><time>${formatTime(row.timeUs)}</time><small>${e(row.source||'')} · ch ${e(row.channel??'—')}</small></td><td class="mono">${e((row.clients||[row.client]).filter(Boolean).join(', ')||'—')}<small>${e(row.ap||row.bssid||'No interface')}</small></td><td>${e(protocolLabel(row))}${row.type&&row.security?.protocol?`<small>Frame: ${e(row.type)}</small>`:''}${row.reasonCode!=null?`<small>Reason ${e(row.reasonCode)}</small>`:''}</td></tr>`).join('')||'<tr><td colspan="4">No admitted source records are available for this selection.</td></tr>'}</tbody></table></div><div class="cw-detail-pagination"><button type="button" class="btn" data-clue-evidence-page="-1" ${page<=0?'disabled':''}>Previous</button><span>${total?page*pageSize+1:0}–${Math.min((page+1)*pageSize,total)} of ${number(total)}</span><button type="button" class="btn" data-clue-evidence-page="1" ${(page+1)*pageSize>=total?'disabled':''}>Next</button></div><p class="cw-detail-note">Frame references open the original source-reported fields. A matching record is evidence of an observation, not proof of cause or service recovery.</p>`,body=>{
      body.querySelectorAll('[data-clue-source-frame]').forEach(button=>button.onclick=()=>ctx.onFrame(button.dataset.clueSourceFrame,()=>showEvidence(ids,page),shown.map(row=>row.id)));
      body.querySelectorAll('[data-clue-evidence-page]').forEach(button=>button.onclick=()=>showEvidence(ids,page+Number(button.dataset.clueEvidencePage)));
    });
  }
  function showCoverage() {
    const coverage=view.coverage||{};
    showDialog('Measurement coverage',`<p class="cw-detail-intro">Know which questions this evidence can answer before interpreting a pattern.</p><div class="cw-capability-list">${(coverage.capabilities||[]).map(item=>`<section><div><strong>${e(item.label)}</strong><span class="cw-capability-state ${['available','observed'].includes(item.state)?'is-available':''}">${e(human(item.state))}</span></div><p>${e(item.detail||item.description||'')}</p></section>`).join('')}</div><h3>Limits on interpretation</h3><ul class="cw-limit-list">${(coverage.limitations||[]).map(item=>`<li>${e(typeof item==='string'?item:item.description||item.title)}</li>`).join('')||'<li>Recorded time and radio metadata require independent validation.</li>'}</ul>${(coverage.qualityFindings||[]).length?`<h3>Capture validity findings</h3><p class="cw-detail-note">Validity findings describe the admitted capture, including records outside the comparison projection. These are source-quality observations, not network-failure counts.</p>${coverage.qualityFindings.map(item=>`<details class="cw-small-details"><summary>${e(item.source||'Source')} · ${e(item.title||item.id||'Validity finding')}</summary><p>${e(item.description||item.summary||'')}</p><p>${e(item.countLabel||'Unknown')} affected capture records</p><div>${(item.evidenceIds||[]).map(id=>`<button type="button" class="cw-text-button" data-clue-quality-frame="${e(id)}">Example ${e(id)} ↗</button>`).join('')}</div></details>`).join('')}`:''}`,body=>{body.querySelectorAll('[data-clue-quality-frame]').forEach(button=>button.onclick=()=>ctx.onFrame(button.dataset.clueQualityFrame,showCoverage));});
  }
  function packet() {
    const data=service.buildAnalysisPacket(queryFor(state),ctx.context);
    if(data&&typeof data.then==='function')throw Error('The evidence packet is not ready yet.');
    return data;
  }
  function showExport() {
    let data;
    try{data=packet();}catch(error){showDialog('Analysis packet unavailable',`<p>${e(error.message)}</p>`);return;}
    const json=safeJson(data),current=queryFor(state),focus=getFocus(state);
    const scopeKey=JSON.stringify({query:current,context:ctx.context});
    const saved=state.lastReport?.scopeKey===scopeKey?state.lastReport:null;
    showDialog('Generate an incident report',`<p class="cw-detail-intro">Ask the configured AI service to connect these clues into a concise, evidence-based assessment and a one-page PDF.</p><dl class="cw-packet-summary"><dt>Focus</dt><dd>${e(focus?.id||'All observed entities')}</dd><dt>Window</dt><dd>${formatTime(view.window?.startUs??current.startUs??captureStart)}–${formatTime(view.window?.endUs??current.endUs??admittedEnd())} UTC</dd><dt>Evidence</dt><dd>Measurements, cohorts, attempts, comparisons, source references and observation limits</dd></dl><label class="cw-note-label" for="cw-engineer-note">Floor context <span>Optional · sent separately from measured evidence</span></label><textarea id="cw-engineer-note" data-clue-engineer-note rows="3" maxlength="12000" placeholder="For example: maintenance started at 12:10; operator reports a two-minute interruption.">${e(state.notes)}</textarea><div class="cw-report-controls"><button type="button" class="btn btn-primary" data-clue-report-generate>Generate incident report →</button><button type="button" class="btn" data-clue-report-cancel hidden>Stop waiting</button></div><p class="cw-send-disclosure">Generating sends this evidence packet and your notes to the configured AI service. API credentials stay on the server.</p><div data-clue-report-status class="cw-report-status" role="status" aria-live="polite"></div><section data-clue-report-result>${saved?reportPreview(saved.result,saved.notes):''}</section><details class="cw-small-details cw-export-section"><summary>Export or inspect the underlying evidence</summary><div class="cw-export-actions"><button type="button" class="btn" data-clue-download>Download JSON ↓</button><button type="button" class="btn" data-clue-copy>Copy evidence JSON</button></div><p data-clue-export-status class="cw-detail-note" role="status">Local export does not send data. Engineer notes are kept separate from this unmodified evidence packet.</p><details class="cw-small-details"><summary>Structured packet · ${number(Math.ceil(new Blob([json]).size/1024))} KB</summary><pre class="cw-json-preview" data-clue-json-preview>${e(json)}</pre></details></details>`,body=>{
      const token=detailGeneration,dialog=document.getElementById('frame-dialog');
      const valid=()=>active()&&detailGeneration===token&&dialog?.open&&body.querySelector('[data-clue-report-generate]');
      const status=body.querySelector('[data-clue-report-status]'),generate=body.querySelector('[data-clue-report-generate]'),cancel=body.querySelector('[data-clue-report-cancel]'),note=body.querySelector('[data-clue-engineer-note]');
      const bindReportFrames=()=>body.querySelectorAll('[data-clue-report-frame]').forEach(button=>button.onclick=()=>ctx.onFrame(button.dataset.clueReportFrame,showExport));
      bindReportFrames();
      if(saved&&saved.notes!==state.notes.trim())status.textContent='The displayed report used different floor notes. Generate again to include these changes.';
      note.oninput=event=>{state.notes=event.target.value;if(saved&&saved.notes!==state.notes)status.textContent='The displayed report used different floor notes. Generate again to include these changes.';};
      cancel.onclick=()=>{reportController?.abort();};
      generate.onclick=async()=>{
        if(reportController)return;
        const engineerContext=state.notes.trim(),controller=new AbortController();reportController=controller;
        generate.disabled=true;cancel.hidden=false;note.disabled=true;status.className='cw-report-status is-loading';status.textContent='Reviewing the selected evidence and preparing the report…';
        try {
          const response=await fetch('/api/incident-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({packet:data,engineerContext}),signal:controller.signal});
          let result;try{result=await response.json();}catch{throw Error(`The report service returned an unreadable response (${response.status}).`);}
          if(!response.ok)throw Error(result?.error?.message||result?.error||`Report generation failed (${response.status}).`);
          if(!result?.report)throw Error('The report service returned no report. Try again.');
          if(!valid())return;
          state.lastReport={scopeKey,notes:engineerContext,result};
          body.querySelector('[data-clue-report-result]').innerHTML=reportPreview(result,engineerContext);bindReportFrames();status.className='cw-report-status is-ready';status.textContent='Report ready. Review its deductions and limits before sharing.';
        } catch(error) {
          if(!valid())return;
          status.className='cw-report-status is-error';status.textContent=error.name==='AbortError'?'Stopped waiting for the report. You can try again.':error.message||'Report generation failed. Try again.';
        } finally {
          if(reportController===controller)reportController=null;
          if(valid()){generate.disabled=false;cancel.hidden=true;note.disabled=false;generate.textContent='Generate incident report →';}
        }
      };
      body.querySelector('[data-clue-download]').onclick=()=>{
        try{const url=URL.createObjectURL(new Blob([json],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=`airframe-analysis-${ctx.incidentId||'capture'}-${new Date().toISOString().slice(0,10)}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);body.querySelector('[data-clue-export-status]').textContent='Evidence packet downloaded locally.';}catch(error){body.querySelector('[data-clue-export-status]').textContent=`Download unavailable: ${error.message}`;}
      };
      body.querySelector('[data-clue-copy]').onclick=async()=>{
        try{await navigator.clipboard.writeText(json);if(valid())body.querySelector('[data-clue-export-status]').textContent='Evidence JSON copied. This copy action sent nothing to the AI service.';}
        catch{if(valid()){body.querySelector('[data-clue-export-status]').textContent='Clipboard unavailable. Download the JSON or select the packet below.';body.querySelectorAll('.cw-export-section details').forEach(element=>element.open=true);const range=document.createRange();range.selectNodeContents(body.querySelector('[data-clue-json-preview]'));const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);}}
      };
    });
  }
  load();
  return ()=>{alive=false;generation++;detailGeneration++;activeEvidence=null;reportController?.abort();};
}

function renderTrends(view,start,end,selectedMetric) {
  const focus=view.comparison?.focus?.label || 'All observed entities';
  const trends=[...[...(view.trends||[])].sort((a,b)=>Number(b.id===selectedMetric)-Number(a.id===selectedMetric)).slice(0,4),...(view.discoveryTrends||[])];
  return `<div class="cw-subheading"><h3>Aligned trends</h3><span>${e(shortId(focus))}</span></div>${trends.map((trend,index)=>{const values=trend.values||[],observed=values.filter(point=>finite(point.value)),last=observed.at(-1);return `<div class="cw-trend-row"><div class="cw-trend-caption"><strong>${e(trend.label)}</strong><span>${e(trend.unit)} <small>scale 0–${valueText(observed.length?Math.max(1,...observed.map(point=>point.value)):null,trend.unit)}</small></span></div>${observed.length?lineSvg(values,{label:trend.label,color:['#8fcfff','#f4bd6c','#b2d7b4','#b9a6e8','#7ec9c4','#d7afc3'][index]}):'<div class="cw-unavailable-trend">Not measurable in this selection</div>'}</div>`;}).join('')||empty('No trend measurements','Expand the time window or inspect measurement coverage.')}<div class="cw-trend-time"><span>${formatTime(start)}</span><span>Recorded UTC · gaps mean unobserved</span><span>${formatTime(end)}</span></div>`;
}
function trendTable(view) {
  return `<div class="cw-detail-table"><table><thead><tr><th>Measurement</th><th>Interval UTC</th><th>Value</th><th>Sample</th></tr></thead><tbody>${[...(view.trends||[]),...(view.discoveryTrends||[])].flatMap(trend=>(trend.values||[]).map(point=>`<tr><td>${e(trend.label)}</td><td>${formatTime(point.startUs)}–${formatTime(point.endUs)}</td><td>${valueText(point.value,trend.unit)}</td><td>${trend.unit==='%'?`${number(point.numerator)} / ${number(point.denominator)} eligible`:`${number(point.numerator)} matches · ${number(point.observations)} observations`}</td></tr>`)).join('')}</tbody></table></div>`;
}
function renderComparison(view,definition,metric) {
  const comparison=view.comparison||{},focus=comparison.focus?.id?comparison.focus:null;
  const groups=[...(focus?[{...focus,isFocus:true}]:[]),...(comparison.peers||[]).slice(0,3)];
  const max=Math.max(1,...groups.map(group=>selectedAggregate(group,metric).value||0));
  const reference=(group,label)=>{const aggregate=selectedAggregate(group,metric);return `<div class="cw-reference-summary"><span>${e(label)}</span><strong>${valueText(aggregate.value,definition.unit)}</strong><small>${e(aggregateCaption(aggregate,definition))}</small></div>`;};
  return `<div class="cw-subheading"><h3>Reference comparison</h3><span>${e(definition.unit)}</span></div><p class="cw-peer-basis">${e(comparison.basis || (focus?'Focus versus other recorded entities in the same window.':'Select a matrix row to compare with its peers.'))}</p>${groups.map(group=>{const aggregate=selectedAggregate(group,metric);return `<div class="cw-compare-row ${group.isFocus?'is-focused':''}"><div><strong>${e(group.label||group.id||'Reference')}</strong><span>${valueText(aggregate.value,definition.unit)}</span></div><div class="cw-compare-track ${finite(aggregate.value)?'':'is-unknown'}"><span style="width:${finite(aggregate.value)?Math.max(0,aggregate.value/max*100):0}%"></span></div><small>${e(aggregateCaption(aggregate,definition))}</small></div>`;}).join('')||'<p class="cw-muted">Select a row to compare its observations with peers.</p>'}${(comparison.peers||[]).length>3?`<p class="cw-peers-disclosure">Highest 3 of ${number(comparison.peers.length)} comparison peers shown.</p>`:''}${focus&&comparison.peerSummary?reference(comparison.peerSummary,`All ${number(comparison.peers?.length||0)} comparison peers`):''}${comparison.global?reference(comparison.global,'Whole selected window'):''}<details class="cw-small-details"><summary>How to read the comparison</summary><p>Counts show recorded activity. Larger counts do not establish a worse failure rate. Rate denominators appear with each value. Client aliases include addressed probe responses; this does not establish association or client reception.</p>${(comparison.limitations||[]).map(item=>`<p>${e(item)}</p>`).join('')}</details>`;
}
function clueStats(clue) {
  const stats=clue.statistics||clue.stats||{};
  const entries=Object.entries(stats).filter(([key,value])=>typeof value==='number'&&!key.endsWith('Us')).slice(0,3);
  return entries.length?`<div class="cw-clue-statistics">${entries.map(([key,value])=>`<div><strong>${number(Math.round(value*100)/100)}</strong><span>${e(key.replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase())}</span></div>`).join('')}</div>`:'';
}
function renderClues(view,state) {
  const clues=[...(view.clues||[])].sort((a,b)=>Number(b.focusMatch)-Number(a.focusMatch));
  const shown=state.showAllClues?clues:clues.slice(0,6);
  return shown.map((clue,index)=>`<article class="cw-clue ${state.selectedClue===clue.id?'is-open':''}"><button type="button" class="cw-clue-summary" data-clue-open="${e(clue.id)}" aria-expanded="${state.selectedClue===clue.id}"><span class="cw-clue-order">${String(index+1).padStart(2,'0')}</span><span><small>${e(human(clue.family||'Observed pattern'))}${clue.focusMatch===false?' · elsewhere':''}</small><strong>${e(clue.title)}</strong></span><span class="cw-clue-chevron" aria-hidden="true">${state.selectedClue===clue.id?'−':'+'}</span></button><p>${e(clue.detail||clue.description||'')}</p>${state.selectedClue===clue.id?`<div class="cw-clue-expanded">${clueStats(clue)}${renderIntervalClue(clue)}<p><strong>Measured relationship</strong>${e(clue.predicate||'See source membership for the qualifying observations.')}</p>${(clue.samples||clue.pairs)?.length?`<div class="cw-delay-samples"><strong>Event-aligned examples</strong>${(clue.samples||clue.pairs).slice(0,5).map(sample=>`<div><span>${finite(sample.elapsedSeconds)?`${sample.elapsedSeconds.toFixed(2)} s`:'—'}</span>${frameButtons([sample.startId,sample.endId].filter(Boolean),'Join → next event')}</div>`).join('')}</div>`:''}${(clue.limitations||[]).slice(0,2).map(limit=>`<p class="cw-clue-limit">${e(limit)}</p>`).join('')}${clue.contraryEvidence?`<p class="cw-clue-limit">${e(clue.contraryEvidence)}</p>`:''}${frameButtons(clue.evidenceIds||[],'Inspect supporting records')}${clue.contraryEvidenceIds?.length?frameButtons(clue.contraryEvidenceIds,'Inspect counterexamples'):''}</div>`:''}</article>`).join('')+(clues.length>6?`<button type="button" class="cw-more-clues" data-clue-more>${state.showAllClues?'Show fewer clues':`Show all ${number(clues.length)} clues`} <span aria-hidden="true">${state.showAllClues?'↑':'↓'}</span></button>`:'')||empty('No clues meet the current rules','The measurements remain explorable. No detected clue does not establish normal operation.');
}

function renderIntervalClue(clue) {
  const values=clue.family==='elapsed_time'?(clue.pairs||[]).map(pair=>pair.elapsedSeconds):(clue.groups||[]).flatMap(group=>group.intervalsSeconds||[]);
  const measured=values.filter(value=>finite(value)&&value>=0);
  if(!measured.length)return '';
  const min=Math.min(...measured),max=Math.max(...measured),width=240,height=85,pad=7,count=12;
  const span=Math.max(max-min,1),buckets=Array.from({length:count},()=>0);
  measured.forEach(value=>buckets[Math.min(count-1,Math.floor((value-min)/span*count))]++);
  const highest=Math.max(...buckets,1),barWidth=(width-2*pad)/count;
  return `<div class="cw-interval-chart"><strong>${clue.family==='elapsed_time'?'Time after association':'Intervals between repeat observations'}</strong><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Distribution of ${measured.length} recorded intervals from ${min.toFixed(2)} to ${(min+span).toFixed(2)} seconds. ${buckets.map((value,index)=>`${(min+index*span/count).toFixed(1)} to ${(min+(index+1)*span/count).toFixed(1)} seconds: ${value} intervals`).join('; ')}"><line x1="${pad}" y1="62" x2="${width-pad}" y2="62" stroke="#415763"/>${buckets.map((value,index)=>`<rect x="${pad+index*barWidth+1}" y="${62-value/highest*47}" width="${barWidth-2}" height="${value/highest*47}" fill="#d9b983"><title>${value} recorded intervals</title></rect>`).join('')}<text x="${pad}" y="78" text-anchor="start">${min.toFixed(1)} s</text><text x="${width-pad}" y="78" text-anchor="end">${(min+span).toFixed(1)} s</text><text x="${width-pad}" y="9" text-anchor="end">peak ${highest}</text></svg><span>${number(measured.length)} recorded intervals · physical timing unverified</span></div>`;
}
function renderComposition(view) {
  const composition=view.composition;
  if(!composition)return '';
  const chart=(label,items)=>{const max=Math.max(1,...items.map(item=>item.count||0));return `<div class="cw-composition-group"><h3>${e(label)}</h3>${items.map(item=>`<button type="button" class="cw-composition-row" data-clue-evidence="${e((item.evidenceIds||[]).join(','))}" aria-label="${e(item.label)}, ${number(item.count)} of ${number(item.denominator)} observations, ${percentage(item.percent)}. Inspect source evidence."><span class="cw-composition-label">${e(item.label)}</span><span class="cw-composition-track"><i style="width:${item.count/max*100}%"></i></span><span class="cw-composition-value">${number(item.count)}<small>${percentage(item.percent)}</small></span></button>`).join('')||'<p class="cw-muted">No matching observations in this scope.</p>'}</div>`;};
  return `<section class="cw-panel cw-composition-panel" aria-labelledby="cw-composition-title"><header class="cw-section-heading"><div><span class="cw-overline">OBSERVATION MIX</span><h2 id="cw-composition-title">What changes in the type of activity?</h2></div><span class="cw-small-label">${e(composition.scope)}<br>Same selected window</span></header><div class="cw-composition-grid">${chart('Termination reasons',composition.terminationReasons||[])}${chart('Protocol observations',(composition.types||[]).slice(0,8))}</div>${composition.types?.length>8?`<details class="cw-composition-more"><summary>Other protocol types (${composition.types.length-8})</summary>${chart('Additional protocol observations',composition.types.slice(8))}</details>`:''}<details class="cw-composition-more"><summary>Association response statuses (${composition.associationStatuses?.length||0})</summary>${chart('Association response statuses',composition.associationStatuses||[])}</details><p class="cw-panel-note">Bars show counts; percentages use each group’s observation total. ${composition.types?.length>8?`Top 8 of ${composition.types.length} protocol types shown. `:''}Select a bar to inspect the matching source records. Error names do not establish causes.</p></section>`;
}

function protocolLabel(event) {
  const security=event?.security||{};
  if(security.protocol==='EAP') {
    const code={1:'Request',2:'Response',3:'Success',4:'Failure'}[security.code]||human(security.code||'message');
    const method={1:'Identity',2:'Notification',3:'Legacy NAK',4:'MD5',13:'TLS',21:'TTLS',25:'PEAP',26:'MSCHAPv2',43:'FAST',55:'TEAP'}[security.eapType]||(security.eapType!=null?`method ${security.eapType}`:'');
    return `EAP ${code}${method?' · '+method:''}${security.identifier!=null?' · ID '+security.identifier:''}`;
  }
  if(security.protocol==='EAPOL-Key')return `Key message${security.keyStage?' · '+security.keyStage:''}${security.replayCounter!=null?' · counter '+security.replayCounter:''}`;
  return event?.label||event?.type||human(event?.kind)||'Recorded observation';
}
const reasonEntries = row => Array.isArray(row.reasonCounts)?row.reasonCounts.map(item=>[String(item.reasonCode??item.reason??item.id),Number(item.count??item.value??0)]):Object.entries(row.reasonCounts||{}).map(([key,value])=>[key,Number(value?.count??value)]);
const protocolGroupLabel = id => ({eap_observed:'EAP observed',keys_observed:'Key messages observed',protected_only:'Protected traffic only',association_only:'Association only',discovery_only:'Discovery only'}[id]||human(id));
function reasonCadence(row,reason) {return [...(row.reasonCadences||[])].filter(item=>String(item.reasonCode)===String(reason)).sort((a,b)=>(b.intervalCount??0)-(a.intervalCount??0))[0];}
function renderCohorts(view,state) {
  const cohort=view.clientCohorts;
  if(!cohort)return '';
  const all=cohort.rows||[];
  let rows=all.filter(row=>state.cohortFilter==='all'||(state.cohortFilter==='associated'?finite(row.firstAssociationUs):row.observedProtocolCohort===state.cohortFilter));
  if(state.cohortFocusOnly)rows=rows.filter(row=>row.focusMatch);
  const reasonCounts=new Map();for(const row of all)for(const [reason,count] of reasonEntries(row))reasonCounts.set(reason,(reasonCounts.get(reason)||0)+count);
  const reasonOptions=[...reasonCounts].sort((a,b)=>b[1]-a[1]);
  if(state.cohortReason==null)state.cohortReason=reasonOptions[0]?.[0]||null;
  const reason=state.cohortReason;
  if(reason!=null&&!reasonCounts.has(reason))reasonOptions.push([reason,0]);
  const peerSubject=all.find(row=>row.client===state.cohortPeerClient),peerAps=peerSubject?.associationAps||peerSubject?.aps||[];
  if(state.cohortPeerClient)rows=rows.filter(row=>row.client===state.cohortPeerClient||(row.associationAps||row.aps||[]).some(ap=>peerAps.includes(ap)));
  const onset=row=>row.firstByReason?.[reason]?.timeUs??(reason==='2'?row.firstReason2Us:null);
  const valueFor=row=>state.cohortSort==='join'?row.firstAssociationUs:state.cohortSort==='onset'?onset(row):state.cohortSort==='cadence'?reasonCadence(row,reason)?.medianSeconds:state.cohortSort==='terminations'?reasonEntries(row).reduce((sum,[,count])=>sum+count,0):state.cohortSort==='progress'?row.securityProgress?.protected:row.client;
  rows.sort((a,b)=>{const av=valueFor(a),bv=valueFor(b);if(av==null&&bv==null)return String(a.client).localeCompare(String(b.client));if(av==null)return 1;if(bv==null)return-1;return state.cohortDirection*(typeof av==='string'?av.localeCompare(bv):av-bv)||String(a.client).localeCompare(String(b.client));});
  const pageSize=20,page=Math.min(state.cohortPage||0,Math.max(0,Math.ceil(rows.length/pageSize)-1));state.cohortPage=page;
  const shown=rows.slice(page*pageSize,(page+1)*pageSize);
  const groups=view.protocolCohorts?.rows||[];
  const header=(key,label)=>`<th scope="col" aria-sort="${state.cohortSort===key?(state.cohortDirection===1?'ascending':'descending'):'none'}"><button type="button" data-clue-cohort-sort="${key}">${e(label)} <span aria-hidden="true">${state.cohortSort===key?(state.cohortDirection===1?'↑':'↓'):'↕'}</span></button></th>`;
  return `<section class="cw-panel cw-cohort-panel" aria-labelledby="cw-cohort-title"><header class="cw-section-heading"><div><span class="cw-overline">CLIENT COHORTS</span><h2 id="cw-cohort-title">Who enters the same failure pattern?</h2></div><span class="cw-small-label">All interfaces remain in scope<br>Select a client for its attempt sequence</span></header><div class="cw-cohort-controls"><label>Population<select data-clue-cohort-filter aria-label="Client cohort population"><option value="associated" ${state.cohortFilter==='associated'?'selected':''}>Associated clients</option><option value="all" ${state.cohortFilter==='all'?'selected':''}>All observed aliases</option>${groups.map(group=>`<option value="${e(group.id)}" ${state.cohortFilter===group.id?'selected':''}>${e(group.label||protocolGroupLabel(group.id))} (${number(group.clientCount)})</option>`).join('')}</select></label><label>Recurrence<select data-clue-cohort-reason aria-label="Termination reason for cohort onset and cadence">${reasonOptions.map(([code,count])=>`<option value="${e(code)}" ${code===reason?'selected':''}>Reason ${e(code)}${count?'':' · not in window'}</option>`).join('')}</select></label><label class="cw-check"><input type="checkbox" data-clue-cohort-focus ${state.cohortFocusOnly?'checked':''}>Only focus matches</label><span>${number(rows.length)} clients · counts in selected window</span>${state.cohortPeerClient?`<button type="button" class="cw-cohort-peer-filter" data-clue-clear-peer>Same-interface peers of ${e(state.cohortPeerClient)} ×</button>`:''}</div><div class="cw-cohort-table-wrap" tabindex="0" role="region" aria-label="Sortable client cohort comparison"><table class="cw-cohort-table"><thead><tr>${header('client','Client / interfaces')}${header('join','First join / rank')}${header('onset',reason!=null?'Reason '+reason+' onset':'Termination onset')}${header('terminations','Termination mix')}${header('cadence',reason!=null?'Reason '+reason+' cadence':'Cadence')}${header('progress','Later observations')}</tr></thead><tbody>${shown.map(row=>{const reasons=reasonEntries(row),total=reasons.reduce((sum,[,count])=>sum+count,0),cadence=reasonCadence(row,reason),progress=row.securityProgress||{},rank=state.cohortFilter==='associated'||state.cohortFilter==='all'?row.joinRank:row.cohortJoinRank;return `<tr class="${state.selectedClient===row.client?'is-selected':''} ${row.focusMatch?'is-focus-match':''}"><td><button type="button" class="cw-text-button mono" data-clue-client-attempts="${e(row.client)}">${e(row.client)} <span aria-hidden="true">→</span></button><small>${e((row.aps||[]).join(', '))}</small><em>${e(protocolGroupLabel(row.observedProtocolCohort))}</em></td><td><strong>${formatTime(row.firstAssociationUs)}</strong><small>${rank!=null?'#'+number(rank)+(state.cohortFilter==='associated'||state.cohortFilter==='all'?' overall':' in group'):'No join observed'}</small></td><td><strong>${formatTime(onset(row))}</strong><small>${finite(onset(row))?'first in admitted history':'Not observed'}</small><small>Any termination ${formatTime(row.firstTerminationUs)}</small></td><td><div class="cw-reason-mix" aria-label="${e(reasons.map(([code,count])=>`Reason ${code}: ${count}`).join('; ')||'No terminations observed')}">${reasons.map(([code,count],index)=>`<span style="width:${total?count/total*100:0}%;background:${reasonColor(code,index)}" title="Reason ${e(code)}: ${number(count)}"></span>`).join('')}</div><small>${reasons.map(([code,count])=>`R${e(code)} ${number(count)}`).join(' · ')||'0 among observed records'}</small></td><td><strong>${finite(cadence?.medianSeconds)?cadence.medianSeconds.toFixed(2)+' s':'—'}</strong><small>${cadence?`${number(cadence.intervalCount??cadence.count)} intervals`:'No repeat interval'}</small></td><td><div class="cw-progress-pills"><span title="EAP requests / responses">EAP ${number(progress.eapRequests??0)}/${number(progress.eapResponses??0)}</span><span class="${progress.keys?'is-observed':''}" title="Key message observations">Key ${number(progress.keys??0)}</span><span class="${progress.protected?'is-observed':''}" title="Protected data observations, not application success">Data ${number(progress.protected??0)}</span></div>${progress.eapSuccess||progress.eapFailure?`<small>EAP result: ${number(progress.eapSuccess??0)} success / ${number(progress.eapFailure??0)} failure</small>`:`<small>${progress.eapRequests||progress.eapResponses?'No EAP outcome observed':'EAP not observed'}</small>`}</td></tr>`;}).join('')||'<tr><td colspan="6">No matching clients in this window. This does not establish normal operation.</td></tr>'}</tbody></table></div><div class="cw-cohort-footer"><span>${rows.length?page*pageSize+1:0}–${Math.min((page+1)*pageSize,rows.length)} of ${number(rows.length)} clients</span><div><button type="button" data-clue-cohort-page="-1" ${page===0?'disabled':''}>Previous</button><button type="button" data-clue-cohort-page="1" ${(page+1)*pageSize>=rows.length?'disabled':''}>Next</button></div></div><details class="cw-small-details cw-cohort-definition"><summary>How to interpret cohorts and join order</summary><p>Join order uses admitted history up to the selected window end. Reason onset uses the same admitted history; counts, cadence and security observations describe the selected window. Cadence shows the largest AP/source group for the selected reason. The population filter exposes observed protocol groups; it does not identify a configured security profile, device model or factory role.</p>${(cohort.limitations||[]).map(limit=>`<p>${e(limit)}</p>`).join('')}<p>${e((view.profileCohorts?.limitations||['Configured security profiles are unavailable in this publication.']).join(' '))}</p></details></section>`;
}
function reasonColor(reason,index=0) {return ({'2':'#e5b56d','23':'#9ccfec','3':'#b7a0d1'}[String(reason)]||['#97c9ab','#cca0b5','#a9b9d0','#a8c1bc'][index%4]);}
function renderReasonTransitions(view) {
  const series=view.reasonTrends||[];
  if(!series.length)return '';
  const bins=view.matrix?.bins||[],maximum=Math.max(1,...series.flatMap(item=>(item.values||[]).map(point=>finite(point.value)?point.value:0)));
  const width=720,height=145,left=35,right=10,top=15,bottom=27,plot=width-left-right;
  const marks=series.map((item,index)=>{let connected=false;const path=(item.values||[]).map((point,b)=>{if(!finite(point.value)){connected=false;return '';}const command=connected?'L':'M';connected=true;return `${command}${left+(b+.5)/Math.max(1,bins.length)*plot},${height-bottom-point.value/maximum*(height-top-bottom)}`;}).join(' ');return `<path d="${path}" fill="none" stroke="${reasonColor(item.reasonCode,index)}" stroke-width="2.2"/>`;}).join('');
  return `<section class="cw-panel cw-reason-transition-panel" aria-labelledby="cw-reason-transition-title"><header class="cw-section-heading"><div><span class="cw-overline">SHARED CLOCK · REASON TRANSITIONS</span><h2 id="cw-reason-transition-title">Does the failure change form?</h2></div><span class="cw-small-label">${e(view.comparison?.focus?.label||'All observations')}<br>One common count scale</span></header><div class="cw-reason-transition"><div class="cw-reason-legend">${series.map((item,index)=>`<span><i style="background:${reasonColor(item.reasonCode,index)}"></i>${e(item.label)} · ${number((item.values||[]).reduce((sum,point)=>sum+(point.numerator||0),0))}</span>`).join('')}</div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Termination reason counts over the shared window, using a common zero to ${maximum} observations scale. Exact values are available below."><line x1="${left}" y1="${top}" x2="${width-right}" y2="${top}" class="cw-chart-guide"/><line x1="${left}" y1="${height-bottom}" x2="${width-right}" y2="${height-bottom}" class="cw-chart-axis"/><text x="${left-8}" y="${top+3}" text-anchor="end">${maximum}</text><text x="${left-8}" y="${height-bottom+3}" text-anchor="end">0</text>${marks}<text x="${left}" y="${height-6}" text-anchor="start">${formatTime(view.window?.startUs)}</text><text x="${width-right}" y="${height-6}" text-anchor="end">${formatTime(view.window?.endUs)} UTC</text></svg></div><details class="cw-small-details cw-cohort-definition"><summary>Exact intervals and source membership</summary><div class="cw-detail-table"><table><thead><tr><th>Recorded UTC</th>${series.map(item=>`<th>${e(item.label)}</th>`).join('')}</tr></thead><tbody>${bins.map((bin,index)=>`<tr><td>${formatTime(bin.startUs)}–${formatTime(bin.endUs)}</td>${series.map(item=>{const point=item.values?.[index];return `<td>${point?.evidenceIds?.length?frameButtons(point.evidenceIds,valueText(point.value,'observations')):valueText(point?.value,'observations')}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div></details><p class="cw-panel-note">Reason labels describe recorded terminations. A falling reason count does not establish recovery. Recorded-time alignment is unvalidated.</p></section>`;
}
function renderAttemptPanel(result,state,view) {
  if(!result)return `<section class="cw-panel cw-attempt-panel" data-clue-attempt-panel>${empty('Attempt detail unavailable','The evidence service does not expose attempt timelines for this selection.')}</section>`;
  const attempts=result.attempts||[],index=Math.min(state.attemptIndex||0,Math.max(0,attempts.length-1));state.attemptIndex=index;
  const attempt=attempts[index],events=attempt?.events||[];
  const hasJoin=finite(attempt?.startUs),start=hasJoin?attempt.startUs:(attempt?.firstObservedUs??events[0]?.timeUs),finish=attempt?.endUs??events.at(-1)?.timeUs,span=Math.max(1,(finish??start??0)-(start??0));
  const subject=view?.clientCohorts?.rows?.find(row=>row.client===state.selectedClient),hasPeers=!!(subject?.associationAps||subject?.aps||[]).length;
  return `<section class="cw-panel cw-attempt-panel" data-clue-attempt-panel aria-labelledby="cw-attempt-title"><header class="cw-section-heading"><div><span class="cw-overline">CLIENT SEQUENCE</span><h2 id="cw-attempt-title">${e(state.selectedClient)} · attempts and observation segments</h2></div><div class="cw-attempt-heading-actions"><button type="button" class="cw-text-button" data-clue-same-interface ${hasPeers?'':'disabled'}>Compare same-interface peers ↗</button><button type="button" class="cw-text-button" data-clue-close-attempt>Close ×</button></div></header><div class="cw-attempt-controls"><button type="button" data-clue-attempt-direction="-1" ${index===0&&!(result.page>0)?'disabled':''}>← Previous</button><label>Attempt<select data-clue-attempt-index aria-label="Selected observed attempt">${attempts.map((item,i)=>`<option value="${i}" ${i===index?'selected':''}>${(result.page||0)*(result.pageSize||20)+i+1} · ${formatTime(item.startUs??item.firstObservedUs??item.events?.[0]?.timeUs)}${finite(item.startUs)?'':' · join not observed'}</option>`).join('')}</select></label>${(result.total??attempts.length)>(result.pageSize||20)?`<label>Page<select data-clue-attempt-page aria-label="Attempt sequence page">${Array.from({length:Math.ceil(result.total/(result.pageSize||20))},(_,page)=>`<option value="${page}" ${page===(result.page||0)?'selected':''}>${page+1} · ${page*(result.pageSize||20)+1}–${Math.min((page+1)*(result.pageSize||20),result.total)}</option>`).join('')}</select></label>`:''}<button type="button" data-clue-attempt-direction="1" ${index>=attempts.length-1&&result.nextPage==null?'disabled':''}>Next →</button><span>${number(result.total??attempts.length)} total segments · ${(result.page||0)*(result.pageSize||20)+1}–${(result.page||0)*(result.pageSize||20)+attempts.length} in this page</span></div>${attempt?`<div class="cw-attempt-summary"><strong>${formatTime(start)}–${formatTime(finish)} UTC</strong><span>${hasJoin&&finite(attempt.elapsedSeconds)?attempt.elapsedSeconds.toFixed(2)+' recorded seconds':'Join not observed · offset from first record'}</span><span>${attempt.terminationReason!=null?'Ends with reason '+e(attempt.terminationReason):e(attempt.censoring?.right?'Segment ends without observed termination':'No terminating event observed')}</span></div><div class="cw-attempt-timeline" aria-label="Observed sequence relative to ${hasJoin?'association':'first observed record'}"><div class="cw-attempt-track">${events.map(event=>`<button type="button" class="cw-attempt-dot ${event.security?.protocol?'is-security':event.reasonCode!=null?'is-termination':''}" style="left:${Math.min(100,Math.max(0,(event.timeUs-start)/span*100))}%" data-clue-attempt-frame="${e(event.id)}" title="+${((event.timeUs-start)/1e6).toFixed(3)} s · ${e(protocolLabel(event))}" aria-label="${e(event.id)} at ${((event.timeUs-start)/1e6).toFixed(3)} seconds: ${e(protocolLabel(event))}"></button>`).join('')}</div><div class="cw-attempt-axis"><span>+0 s · ${hasJoin?'successful association':'first observed record'}</span><span>+${(span/1e6).toFixed(2)} s</span></div></div><div class="cw-attempt-events" tabindex="0" role="region" aria-label="Parsed attempt observations"><table><thead><tr><th>${hasJoin?'After join':'After first record'}</th><th>Parsed exchange / outcome</th><th>Source record</th></tr></thead><tbody>${events.map(event=>`<tr><td class="mono">+${((event.timeUs-start)/1e6).toFixed(3)} s</td><td><strong>${e(protocolLabel(event))}</strong>${event.reasonCode!=null?`<small>Termination reason ${e(event.reasonCode)}</small>`:''}<small>${e(event.ap||event.bssid||'')} · ${e(event.source||'')}${event.security?.protocol==='EAP'&&![3,4].includes(event.security.code)?' · No outcome established by this message':''}</small></td><td><button type="button" class="cw-text-button mono" data-clue-attempt-frame="${e(event.id)}">${e(event.id)} ↗</button></td></tr>`).join('')||'<tr><td colspan="3">No parsed events in this attempt.</td></tr>'}</tbody></table></div>`:empty('No observed attempts in this window','A missing association or sequence is an observation gap, not a failed-join verdict.')}<details class="cw-small-details cw-cohort-definition"><summary>Pairing rule and observation limits</summary><p>${e(result.predicate||result.matchingRule||'Observed sequences begin with a successful association response. Missing records and duplicate transmissions can affect boundaries.')}</p>${(result.limitations||[]).map(limit=>`<p>${e(limit)}</p>`).join('')}</details></section>`;
}
function reportPreview(result,notes='') {
  const report=result.report;
  const findings=typeof report==='object'&&Array.isArray(report.findings||report.insights)?(report.findings||report.insights):[];
  const reportUrl=(value,extension)=>{try{const url=new URL(value,location.href);if(url.origin===location.origin&&new RegExp('^/api/reports/[0-9a-f-]{36}\\.'+extension+'$','i').test(url.pathname))return url.pathname;}catch{}return '';};
  const pdf=reportUrl(result.pdfUrl,'pdf'),evidenceUrl=reportUrl(result.evidenceUrl,'json');
  return `<div class="cw-report-preview"><div class="cw-report-ready"><span class="cw-overline">AI ASSESSMENT · REVIEW REQUIRED</span>${pdf?`<a class="btn btn-primary" href="${e(pdf)}" download>Download one-page PDF ↓</a>`:'<span class="cw-muted">PDF unavailable</span>'}</div><h3>${e(typeof report==='object'?report.title||'Incident assessment':'Incident assessment')}</h3><p class="cw-report-summary">${e(typeof report==='string'?report:report.summary||'')}</p>${findings.slice(0,3).map((finding,index)=>`<article class="cw-report-finding"><span class="cw-overline">${String(index+1).padStart(2,'0')} · ${e(finding.confidence||'Investigative finding')}</span><h4>${e(finding.title||'Evidence relationship')}</h4><p>${e(finding.observation||finding.summary||'')}</p>${finding.reasoning?`<p><strong>What it points to</strong> ${e(finding.reasoning)}</p>`:''}${finding.alternative?`<p><strong>Alternative</strong> ${e(finding.alternative)}</p>`:''}${finding.nextCheck?`<p class="cw-report-next"><strong>Next check</strong> ${e(finding.nextCheck)}</p>`:''}<div>${(finding.evidenceIds||[]).map(id=>/^S\d+-\d+$/.test(id)?`<button type="button" class="cw-text-button mono" data-clue-report-frame="${e(id)}">${e(id)} ↗</button>`:`<span class="cw-report-fact">${e(id)}</span>`).join(' ')}</div></article>`).join('')}${report.limitations?.length?`<div class="cw-report-limits"><strong>Limits</strong><ul>${report.limitations.map(item=>`<li>${e(item)}</li>`).join('')}</ul></div>`:''}${evidenceUrl?`<a class="cw-evidence-download" href="${e(evidenceUrl)}" download>Download evidence and cited analysis facts ↓</a>`:''}${notes?`<details class="cw-small-details"><summary>Engineer context used</summary><p>${e(notes)}</p></details>`:''}<p class="cw-report-meta">${e(result.model||'Configured model')} · ${e(result.generatedAt||'')}<br>Scoped to the evidence snapshot above. Physical cause and service outcome require independent confirmation.</p></div>`;
}
function renderProtocolSummary(view) {
  const summary=view.eapProtocolSummary;if(!summary)return '';
  const total=(summary.requests||0)+(summary.responses||0)+(summary.successes||0)+(summary.failures||0);
  if(!total)return '';
  return `<section class="cw-panel cw-protocol-panel" aria-labelledby="cw-protocol-title"><header class="cw-section-heading"><div><span class="cw-overline">PARSED SECURITY EXCHANGES</span><h2 id="cw-protocol-title">Are requests progressing or restarting?</h2></div><span class="cw-small-label">Capture-wide · selected window<br>Protocol observations, not a cause verdict</span></header><div class="cw-protocol-counts">${[['Requests',summary.requests],['Responses',summary.responses],['Success outcomes',summary.successes],['Failure outcomes',summary.failures]].map(([label,count])=>`<div><strong>${number(count)}</strong><span>${e(label)}</span></div>`).join('')}</div><div class="cw-eap-spacing"><div class="cw-subheading"><h3>Consecutive request spacing</h3><span>Largest recorded-time buckets</span></div>${(summary.intervalBuckets||[]).slice(0,4).map(bucket=>`<div class="cw-eap-spacing-row"><div><strong>${number(bucket.lowerInclusiveSeconds)}–${number(bucket.upperExclusiveSeconds)} s</strong><small>${number(bucket.count)} request pairs</small></div><div class="cw-eap-id-track" aria-label="${number(bucket.changedIdentifiers)} changed identifiers, ${number(bucket.unchangedIdentifiers)} unchanged identifiers, ${number(bucket.unknownIdentifiers)} unknown"><span style="width:${bucket.count?100*bucket.changedIdentifiers/bucket.count:0}%"></span><i style="width:${bucket.count?100*bucket.unchangedIdentifiers/bucket.count:0}%"></i></div><div><strong>${number(bucket.changedIdentifiers)} changed ID</strong><small>${number(bucket.unchangedIdentifiers)} unchanged · ${number(bucket.unknownIdentifiers)} unknown</small></div>${frameButtons(bucket.evidenceIds,'Records')}</div>`).join('')||'<p class="cw-muted">No consecutive request pairs in this selection.</p>'}<p class="cw-panel-note">A changed identifier is not retransmission of one unchanged request. It does not identify which component restarted or why.</p></div><details class="cw-small-details cw-cohort-definition"><summary>Methods, response matching and limits</summary><div class="cw-detail-table"><table><thead><tr><th>EAP method</th><th>Requests</th><th>Responses</th></tr></thead><tbody>${(summary.types||[]).map(type=>`<tr><td>${e(({1:'Identity',13:'TLS',21:'TTLS',25:'PEAP',43:'FAST',55:'TEAP'})[type.eapType]||(type.eapType!=null?'Type '+type.eapType:'No method field'))}</td><td>${number(type.requests)}</td><td>${number(type.responses)}</td></tr>`).join('')}</tbody></table></div><p>${number(summary.responsePairs?.length??0)} matching request/response pairs · ${number(summary.unmatchedResponseIds?.length??0)} unmatched response observations.</p><p>${e(summary.predicate||'')}</p>${(summary.limitations||[]).map(limit=>`<p>${e(limit)}</p>`).join('')}</details></section>`;
}
