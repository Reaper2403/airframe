/** AIRFRAME 2.0: one transport-neutral, cutoff-enforcing evidence boundary. */
import { createDiagnosticService } from './diagnostic-service.js';
const COPY = value => structuredClone(value);
const ORDER = (a, b) => a.timeUs - b.timeUs || a.source.localeCompare(b.source) || a.frameNumber - b.frameNumber;
const LIMITS = ['Cross-source clock alignment unverified.', 'Sensor health and capture loss unavailable.', 'Association does not establish application recovery.'];
const uniqueSources = events => [...new Set(events.map(e => e.source))].sort();
export class EvidenceError extends Error {
  constructor(code, message, retryable = false) { super(message); this.name = 'EvidenceError'; this.code = code; this.retryable = retryable; }
}
function fail(code, message) { throw new EvidenceError(code, message); }

export function createService(input, options = {}) {
  if (!input?.manifest || !Array.isArray(input.events) || !Array.isArray(input.incidents)) fail('dataset_missing', 'The processed evidence bundle is unavailable.');
  const bundle = COPY(input);
  const manifest = bundle.manifest;
  const diagnostics = createDiagnosticService(manifest, options);
  const events = new Map();
  const cases = new Map(bundle.incidents.map(c => [c.id, c]));
  for (const e of bundle.events) {
    if (!Number.isSafeInteger(e.timeUs) || !e.id || events.has(e.id)) fail('parse_incomplete', 'Evidence contains invalid timestamps or duplicate identities.');
    const source = manifest.sources.find(s => s.id === e.source);
    if (!source || source.sha256 !== e.captureHash) fail('capture_hash_mismatch', 'Evidence provenance does not match its source manifest.');
    events.set(e.id, e);
  }
  for (const c of cases.values()) {
    for (const id of [c.openingId, c.authId, c.associationId, ...c.evidenceIds]) {
      if (!events.has(id)) fail('evidence_unavailable', `Investigation ${c.id} references unavailable evidence.`);
    }
  }
  function admit(context = {}) {
    const mode = context.mode ?? 'historical_review';
    if (!['historical_review', 'capture_replay'].includes(mode)) fail('invalid_filter', 'Unknown analysis mode.');
    const cutoffUs = mode === 'historical_review' ? manifest.lastUs : context.cutoffUs;
    if (!Number.isSafeInteger(cutoffUs)) fail('invalid_filter', 'Replay requires a valid integer timestamp.');
    const releaseOrdinal = mode === 'capture_replay' ? context.releaseOrdinal ?? null : null;
    if (releaseOrdinal !== null && (!Number.isSafeInteger(releaseOrdinal) || releaseOrdinal < 0)) fail('invalid_filter', 'Invalid replay release ordinal.');
    return { datasetId: manifest.datasetId, schemaVersion: manifest.schemaVersion,
      parserVersion: manifest.parserVersion, detectorVersion: manifest.detectorVersion,
      projectionVersion: '2.0', aliasVersion: manifest.aliasVersion,
      mode, cutoffUs, releaseOrdinal, generation: context.generation ?? 0 };
  }
  function getCase(id) { const value = cases.get(id); if (!value) fail('evidence_unavailable', 'Investigation unavailable.'); return value; }
  function visibleFrame(id, context) { const e = events.get(id); return e && e.timeUs <= context.cutoffUs && (context.releaseOrdinal === null || e.releaseOrdinal <= context.releaseOrdinal) ? e : null; }
  function getIncident(id, context = {}) {
    const c = getCase(id), admitted = admit(context);
    const opening = visibleFrame(c.openingId, admitted);
    if (!opening) return null;
    const evidence = c.evidenceIds.map(key => visibleFrame(key, admitted)).filter(Boolean).sort(ORDER);
    const auth = visibleFrame(c.authId, admitted), association = visibleFrame(c.associationId, admitted);
    const metricEnd = auth?.timeUs ?? admitted.cutoffUs;
    const metricEvents = evidence.filter(e => e.timeUs <= metricEnd);
    const retry = metricEvents.filter(e => e.type === 'Probe response' && e.retry && e.receiver === c.client);
    const probes = metricEvents.filter(e => e.type === 'Probe request' && e.transmitter === c.client);
    const durationUs = association && association.source === opening.source ? association.timeUs - opening.timeUs : null;
    const lifecycle = association ? 'association_observed' : admitted.cutoffUs >= c.openUs + 20_000_000 ? 'unresolved_at_end' : admitted.cutoffUs >= c.openUs + 5_000_000 ? 'investigating' : 'observing';
    const states = [opening, ...evidence.filter(e => e.type === 'Probe request'), auth, association].filter(Boolean);
    const projection = { id, title: association ? 'Disconnect and association' : 'Disconnect investigation',
      client: c.client, ap: c.ap, openUs: c.openUs, endUs: association?.timeUs ?? null,
      authUs: auth?.timeUs ?? null, durationUs, retryCount: retry.length, probeCount: probes.length,
      viewpoints: uniqueSources(retry).length, probeViewpoints: uniqueSources(probes).length,
      sources: uniqueSources(evidence), retrySources: uniqueSources(retry), probeSources: uniqueSources(probes),
      evidenceGrade: 'partial', cause: 'Unresolved', hypothesisGrade: 'unresolved', lifecycle,
      evidence, anchors: { deauth: opening, auth, association }, limitations: LIMITS,
      revision: `${id}:${admitted.mode}:${admitted.cutoffUs}:${evidence.length}`,
      context: admitted, metricWindow: { startUs: c.openUs, endUs: Math.min(metricEnd, c.windowEndUs), inclusive: true, final: Boolean(auth) },
      observation: association ? `An AP-addressed transmitter sent deauthentication; a successful association response to the same BSSID was captured ${(durationUs / 1e6).toFixed(3)} s later.` : 'An AP-addressed transmitter sent a deauthentication frame. No successful association response is visible yet.',
      nextStep: 'Inspect AP/controller logs for the recorded deauthentication time.',
      stateHistory: states.map(e => ({ frameId: e.id, timeUs: e.timeUs, type: e.type })),
      watch: { thresholdUs: 5_000_000, active: lifecycle === 'investigating', label: 'Demo observation threshold, not a service SLA' },
      selectionKind: 'curated_investigation', exhaustive: false };
    return COPY(projection);
  }
  function queryEvidence(id, filters = {}, context = {}) {
    const admitted = admit(context), incident = getIncident(id, admitted);
    const prior = filters.cursor?.filters ?? {};
    const selection = filters.selection ?? prior.selection ?? 'all', source = filters.source ?? prior.source ?? 'all';
    const type = filters.type ?? prior.type ?? null;
    const page = filters.page ?? filters.cursor?.page ?? 0, pageSize = filters.pageSize ?? prior.pageSize ?? 100;
    if (!['all', 'anchors', 'retry', 'probes'].includes(selection) || !Number.isInteger(page) || page < 0 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) fail('invalid_filter', 'Invalid evidence selection or page.');
    if (source !== 'all' && !manifest.sources.some(s => s.id === source)) fail('invalid_filter', 'Unknown capture source.');
    const binding = JSON.stringify([id, selection, source, type, pageSize, admitted.mode, admitted.cutoffUs, admitted.releaseOrdinal, admitted.generation]);
    if (filters.cursor && filters.cursor.binding !== binding) fail('stale_generation', 'This evidence page belongs to an earlier analysis context.');
    let rows = incident?.evidence ?? [];
    if (selection === 'anchors') rows = Object.values(incident?.anchors ?? {}).filter(Boolean).sort(ORDER);
    if (selection === 'retry') rows = rows.filter(e => e.type === 'Probe response' && e.retry && e.receiver === incident.client && e.timeUs <= incident.metricWindow.endUs);
    if (selection === 'probes') rows = rows.filter(e => e.type === 'Probe request' && e.transmitter === incident.client && e.timeUs <= incident.metricWindow.endUs);
    if (source !== 'all') rows = rows.filter(e => e.source === source);
    if (type && type !== 'all') rows = rows.filter(e => e.type === type);
    const total = rows.length;
    rows = rows.slice(page * pageSize, (page + 1) * pageSize);
    const predicate = { all: 'All client-addressed or client-transmitted observations in the fixed 20-second episode context, through the active cutoff.', anchors: 'Original deauthentication, successful open-system authentication response and association response, when visible.', retry: 'Retry-marked probe-response observations addressed to this client, inclusive opening-to-authentication recorded-time interval (or current prefix).', probes: 'Probe-request observations transmitted by this client, inclusive opening-to-authentication recorded-time interval (or current prefix).' }[selection];
    return COPY({ rows, total, returnedCount: rows.length, page, pageSize, selection, predicate,
      context: admitted, limitations: LIMITS, nextCursor: (page + 1) * pageSize < total ? { page: page + 1, binding, filters: { selection, source, type, pageSize } } : null });
  }
  function getFrame(id, context = {}) {
    const admitted = admit(context), frame = events.get(id);
    if (!frame) return diagnostics.getFrameCached(id, admitted);
    if (!visibleFrame(id, admitted)) fail('outside_replay_cutoff', 'This frame has not been released by replay.');
    return COPY({ ...frame, context: admitted, limitations: LIMITS });
  }
  function answer(id, question, context = {}) {
    const incident = getIncident(id, context), admitted = admit(context);
    if (!incident) return { text: 'This investigation has not opened at the replay cursor.', citations: [], supported: true, context: admitted };
    const q = String(question ?? '').trim().toLowerCase();
    const { deauth, auth, association } = incident.anchors;
    let text, citations = [], supported = true;
    if (/compar|all three|shared|similar|distinguish|explanation/.test(q)) {
      const visible = listIncidents(admitted);
      const reasons = visible.filter(item=>item.anchors.deauth?.reasonCode===23);
      text = `${reasons.length} admitted curated cases report reason 23 (IEEE 802.1X failure). This prioritizes authentication/session control, not a proven shared cause. Similar recorded intervals do not distinguish AAA policy, client retry behavior or RF contribution because physical timing is unvalidated and cases are curated. Inspect capture patterns and client history; request controller/AAA decisions and client supplicant errors for the selected intervals. RF interference requires separate measured evidence.`;
      citations = reasons.map(item=>item.anchors.deauth.id);
    } else if (/recover|service|eap|four-way|handshake|security|application/.test(q)) {
      text = `${association ? 'Association is observed, but' : 'Association is not yet observed, and'} enterprise security and service recovery are not established by this episode's connection anchors. Open Client history to inspect safely minimized EAP/key observations. Missing packets alone do not prove failed exchanges. Request a controller/AAA result, client-visible error and a successful application transaction before verifying recovery.`;
      citations = [deauth,auth,association].filter(Boolean).map(e=>e.id);
    } else if (/earlier|prior|history|before|outside/.test(q)) {
      text = 'The curated episode is a fixed 20-second selection, not the full client history. Open Client history for antecedent EAP and repeated terminations, and Capture pattern for related reason-code observations. All wider evidence remains gated by the active replay cutoff; no physical route or common cause is inferred.';
      citations = [deauth.id];
    } else if (/reason|cause|why|23|controller|next|needed/.test(q)) {
      text = `Reason code ${deauth.reasonCode ?? 'unavailable'} was recorded in ${deauth.id}. ${deauth.reasonCode === 23 ? 'This reports IEEE 802.1X authentication failure; it does not establish a specific RADIUS, credential, certificate or account-lockout cause.' : 'The exact underlying cause is unresolved.'} Inspect AP/controller, AAA and client supplicant evidence for this recorded interval. RF interference is not established. Cause remains unresolved.`;
      citations = [deauth.id];
    } else if (/duration|long|elapsed|time|13\.127/.test(q)) {
      text = association ? `The recorded timestamp difference is ${incident.durationUs.toLocaleString('en-US')} microseconds (${(incident.durationUs / 1e6).toFixed(3)} s), calculated from two observations on ${deauth.source}. Physical timing is unvalidated, including within-source timestamp validity; this is not verified recovery latency or application downtime. Inspect capture-quality findings before timing interpretation.` : 'A completed deauthentication-to-association interval is not available at this replay cursor. No association response is visible yet.';
      citations = association ? [deauth.id, association.id] : [deauth.id];
    } else if (/retr|46|probe/.test(q)) {
      const query = queryEvidence(id, { selection: /client|request/.test(q) ? 'probes' : 'retry', pageSize: 500 }, admitted);
      text = `${query.total} ${query.selection === 'probes' ? 'client-transmitted probe requests' : 'retry-marked probe-response observations addressed to the client'} are visible in the selected recorded-time interval${auth ? '' : ' so far'}. These are captured observations, not a packet-loss percentage or proved unique transmissions. Cross-source clock alignment is unverified.`;
      citations = query.rows.map(e => e.id);
    } else if (/source|coverage|sensor|channel|viewpoint/.test(q)) {
      text = `Retry-response observations have ${incident.viewpoints} source viewpoints; client-transmitted probes have ${incident.probeViewpoints}. These counts describe the visible selection, not sensor health, physical location or clock synchronization.`;
      citations = queryEvidence(id, { selection: 'retry', pageSize: 500 }, admitted).rows.map(e => e.id);
    } else if (/summar|sequence|happen|observ|^summary$/.test(q)) {
      text = `${incident.observation} ${auth ? 'An open-system authentication response was observed; this does not prove EAP completion. ' : ''}Cause remains unresolved.`;
      citations = [deauth, auth, association].filter(Boolean).map(e => e.id);
    } else {
      supported = false;
      text = 'This question is outside the supported evidence interpretation. Use Client history for EAP/key metadata and recurrence, or Capture pattern for related reason-code observations. Exact authentication decisions require controller/AAA and supplicant records for this client and recorded interval; service recovery requires a successful application check. AIRFRAME can prepare that evidence request, but those external sources are not connected.';
    }
    return COPY({ text, citations, supported, context: admitted, limitations: LIMITS });
  }
  function listIncidents(context = {}) { return [...cases.keys()].map(id => getIncident(id, context)).filter(Boolean); }
  return { ...diagnostics, manifest: COPY(manifest), listIncidents, listInvestigations: listIncidents, getIncident, queryEvidence, getFrame,
    answer, contextualAnswer: (intent, id, context) => answer(id, intent, context),
    getSources: (context = {}) => COPY(manifest.sources.map(s => ({ ...s, context: admit(context) }))) };
}

/** Pure prefix-causal D01/D02/D03 evaluation. Input may be any iterable already
 * ordered by event time/source/frame ordinal, including an indexed SQL stream.
 * Returned revisions are append-only. This evaluator never reads beyond cutoff.
 */
export function evaluateDetectors(observations, cutoffUs, options = {}) {
  const watchUs = options.watchUs ?? 5_000_000, horizonUs = options.horizonUs ?? 20_000_000;
  const episodes = [], signals = [], active = new Map(), scopes = new Map(), seen = new Set();
  let last = null, ordinal = 0;
  function revision(ep, state, timeUs, frameId = null) {
    if (ep.state === state) return;
    ep.state = state;
    ep.revisions.push({ revision: ep.revisions.length + 1, state, timeUs, frameId });
  }
  function tick(timeUs) {
    for (const [client, contexts] of active) for (const [bssid, ep] of contexts) {
      if (!ep.associationId && !ep.watchEmitted && timeUs >= ep.openUs + watchUs) {
        ep.watchEmitted = true;
        signals.push({ id: `D02:${ep.openingId}`, detector: 'D02', episodeId: ep.id,
          emittedAtUs: ep.openUs + watchUs, releaseOrdinal: ordinal,
          trigger: 'No association response observed after configured five-second observation threshold.',
          evidenceIds: [ep.openingId], limitations: LIMITS });
        revision(ep, 'investigating', ep.openUs + watchUs);
      }
      if (timeUs >= ep.openUs + horizonUs) {
        if (!ep.associationId) revision(ep, 'unresolved_at_end', ep.openUs + horizonUs);
        contexts.delete(bssid);
        if (!contexts.size) active.delete(client);
      }
    }
  }
  for (const event of observations) {
    if (event.timeUs > cutoffUs) break;
    if (seen.has(event.id)) continue;
    if (last && ORDER(last, event) > 0) fail('invalid_filter', 'Detector input must use canonical recorded-time order.');
    seen.add(event.id); last = event; ordinal += 1; tick(event.timeUs);
    const apOrigin = event.bssid && event.transmitter === event.bssid;
    const client = apOrigin ? event.receiver : event.transmitter;
    if (['Deauthentication', 'Disassociation'].includes(event.type) && client && client !== 'Broadcast') {
      const key = event.bssid ?? 'unknown';
      let contexts = active.get(client);
      if (!contexts) { contexts = new Map(); active.set(client, contexts); }
      let ep = contexts.get(key);
      if (!ep || ep.associationId) {
        ep = { id: `EP:${event.id}`, client, ap: event.bssid, openingId: event.id,
          openUs: event.timeUs, state: null, associationId: null, authId: null,
          evidenceIds: [], revisions: [], watchEmitted: false,
          bssidContexts: event.bssid ? [event.bssid] : [], relatedAssociations: [] };
        contexts.set(key, ep); episodes.push(ep);
        revision(ep, 'disconnect_observed', event.timeUs, event.id);
        signals.push({ id: `D01:${event.id}`, detector: 'D01', episodeId: ep.id,
          emittedAtUs: event.timeUs, releaseOrdinal: ordinal, evidenceIds: [event.id],
          trigger: 'Disconnect management frame observed.', limitations: LIMITS });
      }
    }
    for (const contexts of active.values()) for (const ep of contexts.values()) {
      if (event.transmitter !== ep.client && event.receiver !== ep.client) continue;
      ep.evidenceIds.push(event.id);
      if (event.bssid && event.bssid !== 'Broadcast' && !ep.bssidContexts.includes(event.bssid)) ep.bssidContexts.push(event.bssid);
      if (event.type === 'Probe request' && !ep.associationId && !ep.authId) revision(ep, 'probe_activity_observed', event.timeUs, event.id);
      if (event.type === 'Authentication' && event.statusCode === 0 && event.authTransaction === 2 && event.bssid === ep.ap) {
        ep.authId = event.id; revision(ep, 'auth_success_observed', event.timeUs, event.id);
      }
      if (['Association response', 'Reassociation response'].includes(event.type) && event.statusCode === 0 && event.bssid === ep.ap) {
        ep.associationId = event.id; ep.endUs = event.timeUs;
        revision(ep, 'association_observed', event.timeUs, event.id);
      } else if (['Association response', 'Reassociation response'].includes(event.type) && event.statusCode === 0) {
        ep.relatedAssociations.push({ frameId: event.id, bssid: event.bssid, timeUs: event.timeUs,
          relation: 'same_client_different_bssid', provesSameBssidRecovery: false });
      }
    }
    if (event.retry && event.transmitter) {
      const key = `${event.source}|${event.transmitter}|${event.channel}|${event.type}`;
      let state = scopes.get(key);
      if (!state) { state = { queue: [], latched: false, belowSince: null }; scopes.set(key, state); }
      const previousQueue = state.queue;
      state.queue = previousQueue.filter(e => e.timeUs >= event.timeUs - 2_000_000);
      if (state.queue.length < 6) {
        // The sixth-most-recent retry leaving the inclusive window is the
        // exact first moment the preceding population fell below six.
        state.belowSince ??= previousQueue.length >= 6 ? previousQueue.at(-6).timeUs + 2_000_001 : event.timeUs;
        if (event.timeUs - state.belowSince >= 4_000_000) state.latched = false;
      } else state.belowSince = null;
      state.queue.push(event);
      if (state.queue.length >= 6) state.belowSince = null;
      if (state.queue.length >= 12 && !state.latched) {
        state.latched = true;
        signals.push({ id: `D03:${event.id}`, detector: 'D03', scope: key,
          emittedAtUs: event.timeUs, releaseOrdinal: ordinal,
          trigger: 'At least 12 retry-marked observations in the inclusive trailing 2-second scoped window.',
          count: state.queue.length, evidenceIds: state.queue.map(e => e.id), limitations: LIMITS });
      }
    }
  }
  tick(cutoffUs);
  return { episodes, signals, cutoffUs, releaseOrdinal: ordinal, detectorVersion: 'deterministic-2.0', limitations: LIMITS };
}
