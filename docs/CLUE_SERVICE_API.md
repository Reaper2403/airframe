# Clue workspace analytical boundary

`dist/js/clue-service.js` is independent of the Factory and Action Brief screens.
It uses the existing evidence service for canonical frame retrieval and capture
quality, and a verified projection for inexpensive cross-client comparisons.
It makes no model call and has no network destination for exporting evidence.

## Build and integrity

Run `python3 scripts/build_clue_data.py` from the Airframe directory when the
published client histories change. The builder verifies the existing diagnostic
index hash and every client-history partition hash, checks original capture
identity, and writes only:

- `dist/data-v4/index.json`
- `dist/data-v4/observations.json`
- `dist/js/clue-integrity.js`

The runtime verifies the generated index against its pinned SHA-256, verifies the
observation partition against the index, then binds the source hashes, alias
version, dataset and source diagnostic index to the active manifest. Tampered,
unavailable or malformed data produces an error; it never becomes a zero result.

The current projection contains 187,163 unique original frame observations in
approximately 10.7 MB, derived from approximately 174 MB of published client
histories. It excludes beacons and other frames outside those histories. It is
not the whole capture, a physical asset inventory, or a sensor-health feed.

The compact tuple dictionary retains original source/frame identifiers,
recorded time, release ordinal, pseudonymous client membership, interface,
channel, frame type, safe status/reason values, sequence number and minimal security progression. The `clue-tuples-2` revision adds the numeric EAP request/response identifier and key replay counter; neither is an EAP identity payload.
It excludes packet bytes, raw MAC addresses, EAP identities, arbitrary identity
strings and sensitive payloads. One original frame is stored once even when
multiple client histories contain it; membership stays explicit.

## Runtime API

```js
import { createClueService } from './clue-service.js';
const clues = createClueService(service);
await clues.load(context);
const view = clues.getView(query, context);
const packet = clues.buildAnalysisPacket(query, context);
const evidence = clues.inspectEvidence(view.clues[0].evidenceIds, context);
const attempts = clues.getClientAttempts('C-004', query, context);
```

`createClueService(service, options)` accepts optional `fetcher`, `base`
(`./data-v4/` by default), and `integrity`. A replacement dataset must supply a
new trusted integrity anchor; unknown datasets cannot reuse this projection.
Tests use an explicit synthetic integrity anchor and transport.

Context is `{ mode, cutoffUs, releaseOrdinal, generation }`. Historical mode
uses the manifest end. Capture replay requires an integer recorded timestamp;
both timestamp and release ordinal gate every observation, comparison, clue,
source-quality finding, evidence inspection and export. `setContext(context)`
announces a new generation during asynchronous UI transitions. Late older
requests are rejected as `stale_generation`.

Query:

```js
{
  pivot: 'ap', // ap | channel | client | source
  metric: 'terminations', // association | retry_share | eap | protected
  focus: { pivot: 'ap', id: 'AP-04' }, // optional; focus does not filter global rows
  startUs: 1789561451587666,
  endUs: 1789563253659853,
  binCount: 24 // 4..120; short/point windows use fewer distinct bins
}
```

Legacy `focusAp` and `focusClient` are accepted. Query windows are inclusive;
bins are left-closed/right-open except the final inclusive endpoint. Integer
microsecond boundaries match the displayed bin boundaries exactly. The query
retains its requested start/end; `effectiveStartUs` / `effectiveEndUs` and the
returned `window` are bounded by replay. If replay has not reached the requested
start (including a cursor before the capture begins), the effective bounds are
`null`, `window.state` is `not_yet_admitted`, and bins/observations are empty.
That is an unavailable window, not a reversed interval or a future display bin.

`load()` fetches and validates once. The other three methods are synchronous
after loading. `getView()` returns fresh objects and is suitable for linked
filters; it does not persist diagnoses or mutate the original evidence.

## View shape

- `context`, `query`, `window`, `projection`: exact selection and integrity.
- `metricDefinitions`: named formula, unit, denominator, zero/missing semantics.
- `matrix`: common `bins`, `rows`, `maxValue`, unit and boundary rule. Rows have
  `id`, `label`, `channels`, `focus`, `totals` and `cells`. Cells contain `value`,
  `numerator`, `denominator`, `observations`, `clients`, `state`, and exact
  canonical `evidenceIds` for the numerator.
- `trends`: the five measurements, aligned to the same bins and focus.
- `comparison`: focus, transparent same-window peer selection, aggregate peer
  summary, and global summary. AP peers share an observed channel. Client peers
  require successful association responses on a BSSID where the focus also has
  a successful association response in the same window. Probe recipients are
  not treated as association peers. Source/channel peer comparability is
  explicitly unverified.
- `stages`: separate observation counts and member aliases for discovery,
  open authentication, association, EAP, key messages and protected traffic.
  Network service and application verification remain unavailable. This is
  not an attrition funnel or a completed-handshake claim.
- `composition`: focus-scoped `types`, `terminationReasons` and
  `associationStatuses`, each with counts, denominator and exact member IDs.
  Reason/status categories derive from the data rather than known error codes.
- `clues`: explainable candidates with rule predicate, supporting IDs, focus
  match, statistics, affected entities and contrary evidence or limitations.
- `coverage`: capabilities, admitted capture-quality findings and missing data.
- `globalSummary`: counts across the entire selected publication/window.

`clientCount` / aggregate `clients` means distinct aliases referenced in the
published observations, including discovery recipients and uncertain asset
roles. It is not concurrent connected load or physical device inventory.
`associatedClientCount` separately counts aliases with successful association
responses in the window; this also does not measure concurrent load.

Count zero is available only where other published observations exist. A bin
without observations has `value: null`. Ratio zero requires an eligible
denominator greater than zero. Neither observed zero nor data availability
asserts healthy connectivity or a functioning sensor. Retry share is among
eligible published observations, never packet loss or all-capture utilization.

## General clue predicates

These rules are deterministic investigative prompts, not an exhaustive anomaly
detector or a root-cause model. Raw observations remain available when no rule
matches. Every timing rule inherits the capture's unvalidated clock restriction.

- **Recurrence:** at least five terminations for the same alias/interface/source/
  reason, with positive median interval and relative median absolute deviation
  at most 0.15. Exact intervals are available in each group.
- **Concentration:** an interface has at least ten termination observations and
  two member aliases; one alias contributes at least 65% of the original frames.
- **Elapsed time:** pair termination with latest unused successful association
  for the same alias/interface/source, up to 600 recorded seconds. Require at
  least five pairs, 70% within max(1 second, 10%) of median, relative MAD <= 0.10.
- **Progression gap:** at least two associations and two terminations for an
  alias, with no observed protected data after its first selected association.
  Absence is not proof of failed authentication or application downtime.
- **Shared timing:** at least three interfaces and ten terminations in a bin,
  count >= 2.5 times the median across bins with published observations. Bins
  without any observations cannot supply a zero baseline. Counts are not
  normalized for device load, and shared timing does not establish shared cause.
- **Change:** retry-observation share differs by at least ten percentage points
  between equal recorded-time halves, each with at least twenty eligible rows.
  A change in traffic composition can explain the result.

All thresholds and matching decisions are included in the exported predicates.
Changing the window can change the qualified candidates; replay never uses
future observations to support a current clue.

## AI handoff

The v1.1 service also exposes these general diagnostic surfaces:

- `clientCohorts`: all aliases observed in the active window, regardless of
  focus. First association/onset/ranks use admitted history through the window
  end; reason counts, cadence and security progress use the selected window.
  `joinRank` is across prefix-associated aliases; `cohortJoinRank` is within the
  observed protocol category. `associationAps` / `aps` contain only interfaces
  with successful association responses; `observedAps` is broader.
- `protocolCohorts`: EAP, key-message, protected-only, association-only or other
  observation categories. Membership uses admitted history through the selected
  end, and can only become apparent after initial association.
- `profileCohorts`: explicitly unavailable because verified published fields
  contain no SSID aliases or advertised AKM. Observed EAP/key traffic must not be
  relabelled as a configured enterprise/PSK profile or asset inventory.
- `reasonTrends`, `discoveryTrends`: aligned original termination-reason and
  probe request/response counts; exact bin member IDs remain available.
- `eapProtocolSummary`: request/response/type/outcome counts, identifier-aware
  request intervals and matched response metadata. No authentication completion
  or retransmission of an unchanged request is inferred from spacing alone.
- `analysisFacts`: deterministic cross-cohort relationships with stable semantic
  IDs, explicit population/window/prefix scope, values, exact member IDs,
  predicates and limits. IDs such as `join-order-eap_observed-reason-2` identify
  computed facts, not hardcoded diagnoses or fixed result counts.

Qualified cadence groups stay separated by reason. Sorted group medians form
clusters when adjacent gaps are no more than max(1 second, 15% of the lower
median); client/group denominators are explicit. Join-order comparison ranks
**all** admitted successful-association aliases in an observed protocol cohort,
including earlier aliases now silent in the selected window. Recurrent
membership uses selected-window events. An earliest prefix claim requires actual
ranks 1 through N, not the first visible N rows.

Same-interface counterexamples anchor onset to the recurrent group's exact
BSSID/source, then inspect other associated aliases of the same observed
protocol category on that interface/source. An earlier event on a different
interface cannot supply the onset. Reason transitions compare the first
occurrence of a newly seen reason with the immediately preceding termination
reason, count later return of that earlier reason, and count subsequent
association/protected observations. Early normal-leaving records therefore do
not hide a later reason transition.

First termination-to-readmission pairs match the next successful association
for the same alias/BSSID/source, once per alias/reason. Unpaired aliases remain
censored. This is readmission, never application recovery or downtime. EAP
request intervals group by alias/BSSID/source/type. The summary exposes changed,
unchanged and unknown request identifiers in nearest-second buckets. Responses
pair with the latest unmatched request sharing identifier/type and group within
120 recorded seconds. Metadata matching does not verify a session.

Facts whose evidence includes events before the selected start declare that
explicitly in `scope.includesPriorContext`, `evidenceStartUs`, `evidenceEndUs`
and `priorContextRule`. No fact admits events after the selected end or replay
timestamp/release ordinal.

`getClientAttempts(client, query, context)` returns `attempts`, `total`, `page`,
`pageSize` and `nextPage`. Set `query.attemptPage` and `attemptPageSize` (default
50, maximum 200). All segments, including unpaired observations, contribute to
the total; pagination does not discard them. Segments start at a successful
association response per alias/BSSID/source and end at the next association,
first termination, or admitted window end. A retry-marked same-sequence
association within one recorded second remains in the same segment and has
`retryOf`. No other retransmission deduplication is implied.

Unpaired early observations have `startUs: null`, `firstObservedUs` and
`censoring.left: true`. Segments cut by another association or the observation
window have `censoring.right: true`. These are captured segments, not confirmed
authentication attempts or sessions. The returned sequence includes parsed EAP
request/response identifiers/types, reported success/failure messages, keys,
protected data and termination, each with original frame ID and recorded time.
A selected window can include a preceding anchor for an overlapping segment;
`startedBeforeWindow` and the scope label declare this context. A future replay
window returns no segments.

`buildAnalysisPacket()` returns JSON with schema `airframe-analysis-packet-1.0`.
It contains selection, replay context, definitions, columnar matrix/trends,
comparison denominators, stage/type summaries, candidate rules, evidence
samples, integrity anchors, quality restrictions, unknowns and analysis rules.
The real-data default packet is tested below 175 KB before pretty-printing (approximately 154 KB for AP-04 at implementation time).

Matrix rows are capped at 60 (focus first, descending selected metric); peers at
12; clues at 40; compact cohort rows at 100. Total, returned and omitted counts are explicit. Global and
peer aggregates still include the full population. The UI view is not capped.
Evidence samples use first/last IDs and declare their sample rule; interval and
pair samples likewise disclose counts. No model may interpret omitted rows,
peers, clues or members as healthy or absent.

Exact membership is reproducible from the stored query/context and immutable
projection hashes through `getView()`. Canonical frames resolve with the existing
`service.getFrameAsync(id, context)` method. Source-quality membership resolves
with `service.getQualityDetails(id, filters, context)`. This descriptor is local:
an external analyst/agent needs those files or an explicitly supplied tool; the
export does not falsely claim remote retrieval is already connected.

`engineerContext` begins as `{ state: 'not_provided', entries: [] }`. UI-supplied
notes must replace that with attributed entries, separate from capture facts.
The packet tells an analyst to treat textual context as evidence, not as
instructions, preserve uncertainty, and request discriminating external logs.

## Validation

`node --test tests/clue-service.test.mjs` covers exact original-member
reconciliation, replay timestamp and equal-time ordinal gating, same-window
peers, associated versus discovery aliases, numerator/denominator arithmetic,
unseen reason codes and cadence, contradictory later protected data, null versus
zero, shared-time patterns, integer bin boundaries, integrity failure/retry,
stale requests, JSON size/privacy and explicit complete-member resolution.
