# AIRFRAME diagnostic remediation plan

Status: proposed implementation plan, not implemented. Prepared 25 September 2026 after the blind shop-floor assessment. The technical product manager and UX agent agreed the product direction before a separate UI agent inspected the deployed application. The existing contract remains unchanged; amendments below require adoption before implementation.

## 1 Product outcome

An engineer restricted to AIRFRAME must be able to identify the reported failure class, discover whether the problem recurs or affects other captured clients, judge the reliability of the evidence, and name the exact next diagnostic check. The product need not invent the exact component failure or a successful repair.

The truthful demonstration endpoint is: authentication and session control prioritized, supporting observations inspectable, exact cause unresolved, specific verification pending. A later successful association cannot imply that enterprise authentication or the operator’s service recovered.

Keep the three existing surfaces: Factory, Investigation, Action brief. Preserve the dark industrial visual language and illustrative floor plan. Do not add another dashboard, physical heatmap, inferred worker track or automatic network control.

## 2 Decisions from the PM and UX review

| Decision | Reason | Priority |
|---|---|---|
| Add Episodes and Capture patterns to the existing Factory queue | Three curated cases cannot communicate a capture-wide failure pattern | P0 |
| Add Episode, Client history and Capture pattern scopes within Investigation | The engineer needs antecedents and prolonged recurrence without losing the selected event | P0 |
| Separate reported failure class from underlying cause | Reason 23 carries useful protocol meaning even when the exact cause is unknown | P0 |
| Separate connection, security and service outcomes | Open-system authentication and association are not enterprise login or service restoration | P0 |
| Put validity restrictions beside affected measurements | Same-source arithmetic does not establish physically valid recording time | P0 |
| Publish only safely decoded, minimized security metadata | EAP identities must not leak into static files, answers or exports | P0 release gate |
| Use structured explanations and evidence requests | A reliable bounded comparison is more useful than generic conversational refusal | P0 |
| Normalize retries by transmitter and eligible exchange | Client-addressed response counts are not serving-AP retry rates | P1 |
| Keep inventory and tentative roaming candidates in secondary drawers | Useful context without overwhelming the primary incident workflow | P1 |

P0 means required for the next trustworthy diagnostic demo. P1 completes the secondary diagnostic coverage. Capture patterns and recurrence have deliberately moved from secondary priority in parts of the assessment to P0: without them the release would still hide the main operational pattern.

### Scope limits that remain acceptable

Historical replay, illustrative geometry, manual evidence requests, a small curated demonstration entry point and absent production account administration remain acceptable. Live controller/RADIUS integration, calibrated RF positioning, ML prediction and real infrastructure changes are not prerequisites. Missing evidence must be explicit and actionable rather than filled with synthetic outcomes.

## 3 Traceability to every reference finding

Reference quantities are reconciliation targets, not constants to embed in the UI. Recompute them from declared predicates and record discrepancies instead of changing rules to force agreement.

| Finding | User-facing improvement | Processing or evidence dependency | Acceptance boundary |
|---|---|---|---|
| F01 reported 802.1X failures | Decode reason 23; show security progression and capture pattern | Safe EAP metadata parser, global aliases, linked observations | Engineer discovers authentication priority; no assertion of a particular RADIUS, credential, certificate or lockout cause |
| F02 recurring reason-2 terminations | Client history and recurring-termination pattern | Versioned recurrence rule, deduplicated membership and recorded window | Engineer discovers sustained instability beyond one reconnect; event counts remain distinct from episode counts |
| F03 impossible timing | Adjacent timestamp-validity warning and affected-calculation restrictions | Timing-quality rule with exact source/frame references | Recorded intervals remain inspectable; no claim of validated physical latency, airtime or downtime |
| F04 probe-response retries | Transmitter-grouped retry inspection | Defined denominator, defensible pairing, unmatched records and ACK visibility | Another AP’s responses cannot inflate the serving AP’s rate; no inferred packet loss from absent ACKs |
| F05 invalid PHY rates | Raw metadata flagged; dependent calculations unavailable | Frequency/rate validation | Invalid metadata never produces a convincing airtime or utilization number |
| F06 asymmetric visibility | Observed and unobserved stages with later-state reasoning | EAP/key-stage decoding, matching ambiguity and visibility context | Missing M2 stays unobserved; observed M3 can contradict a claim of no later progression without inventing M2 |
| F07 inventory omissions | Observed inventory versus expected-inventory drawer | Observed base-AP/BSSID model; authoritative expected inventory only if supplied | A radio not observed in capture is not declared offline |
| F08 snapshot-length inconsistency | Capture-quality detail and auditable parser handling | Bounds checks, declared-versus-included-length record, provenance | Safe permissive handling is explicit; malformed records are not silently accepted or erased |
| F09 clocks and coverage | Capture coverage, global client deduplication, explicit time basis | Dataset-scoped identity and per-source coverage | Eight channels are not same-frame corroboration or triangulation; one alias is counted once globally |
| F10 identity privacy | Minimized security metadata throughout | Publication allowlist and artifact scans | No raw MAC, SSID or EAP identity in public data, answer context, export or client diagnostic output |
| F11 tentative sticky clients | Qualified investigative candidates in a secondary drawer | Reproducible candidate predicate; sensor-RSSI qualification | No confirmed sticky-client diagnosis, route or tuning recommendation without AP/client evidence |

Additional assessment gaps: answer freshness, unsupported-question specificity, stable replay controls, asynchronous evidence loading, and service-based closure are covered in sections 5–9.

## 4 What is available and what is missing

The current implementation interface documents 1,118,853 local normalized records, but the static browser selection contains 562 observations covering three fixed 20-second contexts. Expanding the existing timeline alone cannot reveal the rest. Current EAP metadata is unsupported; the existing contract explicitly defers it pending verified safe parsing.

| Can be derived or exposed from the existing inputs, subject to verification | Requires additional operational evidence |
|---|---|
| Reason/status meanings and distributions | Exact controller or RADIUS decision, rejection or timeout |
| Client history, capture-wide cohorts and recorded recurrence | Verified account-lockout event and the system that generated it |
| Available EAP and key-exchange metadata and later progression | Client configuration, certificate/trust state and supplicant decisions |
| Retry predicates, transmitter grouping and observation denominators | Reliable RF attribution, spectrum/channel measurements and calibrated link telemetry |
| Capture integrity and invalid metadata findings | Validated capture provenance or replacement recording for physical timing |
| Observed inventory and qualified candidate lists | Authoritative expected inventory and confirmed asset roles |
| Explicit boundaries of association/security observations | Successful application transaction and representative service validation |

The tool must not turn every question into “get more production logs.” It must first expose relevant evidence already present. Equally, it must not pretend these captures establish facts that genuinely require another source.

## 5 Three-surface UX specification

### Factory

Retain the map and attention rail. Use Episodes and Capture patterns tabs in that rail, not a second dashboard. A selected row updates the existing preview. Its primary action enters Investigation with evidence already visible; the next-check action enters the corresponding interpretation section. This keeps overview selection to evidence or next check within two primary selections.

An episode displays failure class, aliases, recorded event time, recurrence cue when known, and the recovery boundary. Preferred copy is “Reported 802.1X failure” and “Association observed · Service unverified,” not “Disconnect and recovery.” A pattern displays one operational sentence, deduplicated client count, observed-frame or defined-episode count, sources and covered interval. Label it an observational grouping, never a shared root cause.

For reference reconciliation, the report describes 506 reason-23 frames across 63 clients and eight sources, and an 18-client reason-2 recurrence pattern. Only independently recomputed values may appear as runtime findings. A definition affordance exposes membership, rule version, time window, count type and cutoff.

Rename unmeasured “Source health” to “Capture coverage.” Its drawer distinguishes file presence, channel coverage, unknown capture health, cross-source alignment and within-source validity. Observed inventory and tentative roaming candidates are secondary content here or in the corresponding investigation drawer. Map placement never contributes to severity or confidence.

### Investigation

Keep one large evidence area and one interpretation area. Place the reported failure and exact-cause boundary before details. Add one scope control: Episode / Client history / Capture pattern. Preserve client, selected observation, parent-pattern breadcrumb, filters where applicable and replay context when changing scope.

- Episode: show its actual window and offer earlier/later context within available capture boundaries.
- Client history: put the selected episode inside a longitudinal overview; recurrence markers open their members without losing context.
- Capture pattern: expose its predicate and compact member-client list; selecting a client enters that client’s history with a return breadcrumb.

Default focus follows the chosen failure class. Authentication is the lead for the current reported pattern, not a universal design assumption for every future incident.

Use two compact progression tracks: connection (open-system authentication and association) and security/service (EAP exchange, key establishment, protected-traffic indication, service verification). Termination and probe activity remain timeline events. Security configuration may be unknown; a stage can be “Not applicable” only when applicability is established.

Stage states are Observed; Not observed in the available window; Not yet observed at cutoff; Unsupported by processing; Unavailable from connected evidence; and Not applicable. “Not yet” must not promise that a later success exists. Contradicted is a claim status, not a packet state. For example, later M3 can contradict a claim that no progression occurred, while absent M2 remains unobserved.

Selecting a stage filters its evidence and explains what that stage establishes. Association does not complete EAP, keys or service. Protected traffic is not proof of a successful application transaction.

Display “Recorded interval: 13.127 s” with an adjacent timing qualification. Where known anomalies apply, state “Recorded timestamps contain validity anomalies. Do not use this as verified physical recovery latency.” Quality details identify the affected source or scope, examples, usable claims, prohibited calculations and required validation. Keep invalid raw metadata inspectable, but suppress derived airtime/utilization claims.

Retry inspection shows transmitter, initial/retry observation counts, denominator definition, matching rule, matched/unmatched observations and ACK visibility. No denominator means no percentage. Ambiguous matching remains ambiguous. Separate source aliases from AP aliases visually and semantically.

Evidence rows retain exact provenance. Filters include stage/type, source and transmitter. A row opens a drawer; previous/next respects current filters. Closing restores focus and scroll position. Counts identify selection membership versus rendered rows.

### Interpretation and questions

Use What is established / Competing explanations / Next discriminating evidence. Each hypothesis has support, counterevidence, unknowns and a specific next check. Use “first subsystem to investigate” rather than invented confidence percentages.

P0 presets: Explain failure class; Show earlier context; Compare selected cases; Distinguish explanations; Establish recovery. Deterministic grounded responses are acceptable. An unrestricted language-model assistant is not required.

Unsupported answers name the missing source or capability and provide a scoped evidence request. Example: “AIRFRAME does not contain the RADIUS decision or client lockout record for this interval. The captured reason-23 frame reports an 802.1X failure, not a specific lockout cause. Request controller/AAA and supplicant evidence for these aliases and this recorded interval.”

Every answer binds to its question, scope, window, cutoff, generation and citations. Submitting replaces the prior current answer with pending state. Navigation must not silently relabel an old answer as current. Preserve a draft after an error and allow retry against the same context.

### Action brief

Lead with “First investigative priority: authentication and session control” and “Exact cause unresolved,” backed by the active evidence. Retain source limitations and human approval boundaries. Prepare an evidence request with aliases, recorded interval, timezone, alignment uncertainty, requested system/fields, the decision it resolves and redaction requirements. A request is not acquired evidence.

Show independent association, security and service outcomes, with recurrence exposure separately assessed. An external result, if later supported, records its operator, time, source, result and scope and is clearly distinguished from packet-derived observations. Request preparation is P0; trusted production integrations are deferred.

Use “Prepare validation plan” when live/new evidence is unavailable. A valid plan names the service problem, comparable exposure, success criteria and approval/rollback conditions. Ten observations or a short no-deauthentication interval alone cannot establish recovery. Missing a required check keeps the overall outcome Inconclusive, not recovered or failed. Analyst closure is distinct from technically verified recovery.

## 6 Proposed contract amendments

Adopt these explicitly before implementation; do not silently broaden version 1.0. Preserve one alias registry, one evidence service and the shell-owned replay clock. No competing stores or per-screen counters.

| Contract addition | Minimum fields and semantics |
|---|---|
| Security metadata allowlist | Permitted protocol type, direction, identifier, result and key-stage fields; bounded parsing; protected/truncated/unsupported reasons; forbidden identity text and application bytes |
| Scope descriptor | Dataset versus published selection versus query versus admitted replay prefix; requested and available bounds; completeness reason; exact predicate |
| Quality finding | Rule/version, affected source/observations, examples, discovered-at cutoff, metric restrictions, prohibited versus qualified uses |
| Capture pattern | Grouping rule, member references, globally deduplicated clients, sources, recorded window, cutoff and limitations; no causal implication |
| Security progression | Client/BSSID context, stage observations, visibility states, matching ambiguity, support and later-state counterevidence |
| Recurrence | Reason/type, unique event membership, configured threshold/version, recorded window and visibility/timing qualifications |
| Retry analysis | Transmitter scope, observation counts, exchange identity rule, matched/unmatched sets, denominator and ACK visibility |
| Claim or hypothesis | Proposition, supporting/counter evidence, unknowns, categorical support and next discriminating request |
| External evidence request | Requested system/fields, aliases and permitted mapping reference, recorded interval/time basis, owner/status, purpose; optional externally sourced result provenance |
| Validation checks | Independent association/security/service/recurrence check outcomes, required/optional designation, supporting provenance and overall inconclusive rule |

Every derived result carries dataset, parser, detector and alias versions; selection predicate; evidence references; scope; cutoff; generation; and limitations. Raw source findings are never overwritten by inferred stages.

## 7 Delivery architecture

Use build-time sanitized full-capture indexes and lazily loaded sanitized evidence chunks for the next static demo. Keep raw captures, identity mappings and unapproved security fields restricted locally. Do not send a million-row bundle to the browser or introduce a fictional live backend.

The current synchronous one-bundle service must be versioned to support asynchronous retrieval. A request identity binds dataset/version, scope/entity, filters, cutoff, equal-timestamp release ordinal and generation. Reject stale responses after seek, mode switch or scope change. Cancel requests when practical; response admission is still required even when cancellation fails.

Indexes support client/time, reason/time, source/time, stage/client/BSSID and exact evidence identity. Every aggregate can resolve its complete membership through stable pagination. A query exceeding a published scope says so; it never returns a misleading zero. Chunk size and client-list pagination are engineering benchmark decisions, not arbitrary product promises.

Replay must gate counts, membership, stages, answers and event-derived quality findings to the admitted prefix. Structural file metadata known during declared preflight may be shown as preflight context; do not expose future event-derived anomaly counts under that label. Historical review is an explicit mode, not a silent escape from replay.

Recompute report comparisons. For example, 54,544 retry flags in the existing interface and 54,484 retry-marked probe responses in the report use different predicates; that difference is not automatically an error. Do not join report hash aliases to UI aliases by guesswork.

## 8 Implementation sequence and ownership

| Work package | Existing ownership | Required output | Depends on |
|---|---|---|---|
| A Contract and privacy gate | Shared contract, M01, M04, M10 | Approved amendments, allowlist, malicious/truncated fixtures, publication checks | Product decisions |
| B Evidence foundation | M01 | Safe security metadata, quality findings, full provenance and sanitized indexes | A |
| C Derived findings | M02, M03 | Cutoff-correct security progression, cohorts, recurrence and claim counterevidence | B |
| D Expanded service | M04 | Asynchronous scoped queries, membership, context-bound answers and typed errors | B, C |
| E Shared controls and Factory | M05, M06 | Scope primitives, coverage drawer, episode/pattern queue | D |
| F Investigation | M07 | Wider history, stage evidence, validity warnings and structured explanations | D, E |
| G Action and validation | M08 | Scoped evidence requests and independent recovery checks | D, E, F |
| H Secondary coverage | M01–M08 as applicable | Transmitter retry analysis, observed inventory and qualified candidates | B–G |
| I Acceptance and blind retest | M10 | Component matrix, replay/privacy checks and new blind-engineer result | E–H |

No production bridge is required from M09. Prepare future integration contracts without claiming those sources are connected.

## 9 Release acceptance

Functional clicks alone are insufficient. Gate the release on all of the following:

1. A fresh engineer using only the UI identifies the reported authentication failure class and relevant controller/AAA/client checks, without the comparison report.
2. That engineer discovers prolonged recurrence and capture-wide affected-client scope, rather than treating three cases as the entire population.
3. Every aggregate equals its inspectable members under the same predicate and cutoff; one client on eight channels is counted once globally.
4. No future stage, count, pattern member, answer citation or event-derived quality finding leaks in replay. Seeking backward removes it and rejects outstanding stale requests.
5. Missing M2 with observed M3 never becomes a fabricated M2 observation or an automatic failed handshake.
6. Reported reason 23 does not become a particular RADIUS, certificate or lockout diagnosis. Missing EAP success is not proof of failure by itself.
7. Timing-invalid or PHY-invalid records cannot generate physical airtime, latency, utilization or retry-spacing conclusions.
8. Another transmitter’s responses cannot become the serving AP’s retry rate; incomplete pairing and ACK visibility remain explicit.
9. Browser files, exports, answer context and diagnostic logs pass identity minimization tests, including EAP identity fixtures.
10. Failed or incomplete evidence loading says Unavailable or Partial, never zero events or healthy service.
11. Changing question, incident, scope, source filter or cutoff cannot leave a stale response appearing current.
12. Required unavailable service/security checks keep validation Inconclusive; association and analyst closure cannot auto-verify recovery.
13. Keyboard focus, stable replay pause, drawer return, reduced motion, non-color status and narrow-screen readability pass component tests.
14. The two-primary-selection path to visible evidence or the next diagnostic step remains intact.

The review does not treat the report as infallible. A disagreement must have a reproducible predicate, evidence references and a written adjudication. Do not alter raw data or confidence labels to match a target narrative.

## 10 UI integration review

The UI agent inspected the deployed Factory, AF-104 Investigation, Action brief and frame-provenance dialog at 1280 × 720, after the PM/UX agreement. It separately read the local UI structure. No saved-plan mutation or application change was made. The breakpoints and dimensions below are proposed design targets, not layouts already tested in the app.

### Findings from the current interface

- The blueprint map and attention rail already deliver the desired industrial visual identity.
- Investigation’s title block, large metric strip and four progression cards push timeline detail, evidence and questions below the fold. Adding more cards would worsen this.
- “Authentication · Status 0” does not visually distinguish open-system authentication from enterprise authentication.
- The inspected Action brief exposes 221 observation buttons in its timeline while a large “Unresolved” headline occupies the main decision area.
- The frame dialog shows numeric reason 23 and “Parse state: valid” without separating parsing success from measurement validity.

### Current to proposed component mapping

| Current component | Proposed replacement or extension | Keep |
|---|---|---|
| Factory attention rail | Episodes / Capture patterns tabs, computed membership and scoped preview | Existing row selection and Open investigation interaction |
| Episode card | Failure class first; aliases/time/recurrence; explicit outcome boundary | Compact card and restrained amber selection |
| Duration-first preview | Reported failure, cause and outcome first; qualified recorded interval second | Exact source evidence links |
| Illustrative map | Clear client marker for capture-wide selection; say “Capture-wide pattern · location not established” | Blueprint geometry; no inferred RF region |
| Source strip | Capture coverage entry to quality and inventory drawer | Compact source/channel access |
| Investigation title and badges | Compact identity block and separate reported-failure/cause statement | Breadcrumb and mode label |
| Three headline metrics | Remove the standalone strip; put interval beside timeline and retries/viewpoints beside their selections | Definitions and exact supporting membership |
| Four progression cards | Two compact semantic tracks for connection and security/service | Clickable evidence linkage |
| Short timeline | Scope-dependent episode, history or pattern view | Original frame drill-down and replay admission |
| Interpretation rail | Established / Competing explanations / Next discriminating evidence | Right-hand reading area |
| Free-form Ask | Secondary disclosure below reliable structured actions | Question draft and cited answer where supported |
| Evidence rows | Prioritize frame, recorded time, event/meaning, source/channel and transmitter | Provenance; signal remains available in details |
| Frame dialog | Raw field, decoded meaning and measurement limitation | Original frame/source/hash references |
| Long Action timeline | Default decision anchors and selected citations; All observations opens paginated evidence | Full membership remains reachable |
| Large Unresolved headline | Investigative priority, established failure class and remaining decision | Honest unresolved exact cause |
| Validation form | Independent recovery boundaries and request/plan preparation | Human approval, local-save disclosure and safe exports |

### Visual system and fold target

Preserve near-black canvas, graphite surfaces, fine blue-gray borders, warm amber attention and pale-blue evidence links. Reserve green for the specific observed outcome, not blanket “recovery.” Status always includes text and an icon or shape.

Proposed desktop tokens: 24 px page gutters, 16 px card padding, 16–24 px section gaps, 6 px card radius; 32 px page heading, 20 px section heading, 16 px explanatory body, 14 px controls/table text and 12 px provenance. Interactive targets are at least 44 px with a 2 px visible focus outline. Retain monospaced aliases, timestamps and frame references. Use 120–180 ms nonessential transitions, disabled under reduced motion.

At 1280 px, target 1232 px usable width: 824 px evidence, 384 px interpretation and a 24 px gap. Keep title/context, scope control and compact failure/quality statement within approximately 220 px above the columns. At 1280 × 720 the failure class, unresolved cause, selected scope and next diagnostic check must be visible without scrolling. Timeline and evidence can continue below the fold; do not shrink text to fit every fact.

Keep Connection as two compact labeled tiles and Security and service as four tiles in a two-by-two group at this width. At wider sizes the second group can become one row. Never draw an uninterrupted green arrow through all stages. The two semantic labels must remain clear, so the layout cannot imply that open authentication completes enterprise security.

Below 1100 px, use one column with a compact finding/next-step summary above evidence and detailed interpretation below it. Below 560 px, use 16 px gutters, vertical stage rows and semantic evidence cards instead of cramped columns. No essential page-level horizontal scrolling. At 200% text zoom, allow reflow rather than clipping.

### Exact navigation and disclosure behavior

1. Factory: select episode or pattern; preview updates. Select Open investigation; evidence and next-check summary are already visible. This is the two-primary-selection path.
2. Pattern investigation: select a member client; enter Client history with a breadcrumb back to the pattern and the same cutoff. Select a recurrence marker; its evidence appears in context.
3. Episode: Earlier context or Later context widens the selected evidence request within actual published coverage. The opening anchor remains indicated and the selection interval updates visibly.
4. Stage or frame: open a single shared drawer. It preserves filters and supports next/previous member navigation. Close restores focus and scroll.
5. Quality finding to frame: replace drawer content rather than stacking overlays; provide an internal Back link.
6. Prepare evidence request: open the existing Action brief with the chosen hypothesis and request selected. Show “Draft request — not sent.” No external message is sent by this operation.
7. Action: show decision-relevant anchors by default, normally five to eight when available, without fabricating anchors to fill a quota. All observations opens the same paginated evidence browser, not hundreds of raw buttons.

Use a 440–480 px quality/provenance drawer on desktop and full-screen presentation below 560 px. The Action brief targets a 336 px context rail plus a flexible decision area at 1280 px; the decision area comes first on narrow screens. Compare hypotheses expands in the interpretation rail, avoiding another competing navigation tab.

### Required copy examples

| Location | Copy and condition |
|---|---|
| Episode card | “Reported 802.1X failure” / “C-004 · AP-04 · Reason 23” / “Association observed · Service unverified” when supported by that selection |
| Pattern card | “Reported 802.1X failures” with computed unique-client and qualifying-observation counts; explicit covered interval and cutoff |
| Recorded interval | “Recorded interval: 13.127 s” / “Physical recovery timing unvalidated”; strengthen to a specific validity issue when its evidence is admitted |
| Frame dialog | “Parse result: Parsed successfully” separately from “Measurement validity: Timing limitations apply” |
| Retry selection | “46 retry-marked probe responses in this selection” / “Multiple transmitters · Not the serving AP’s retry rate” for the verified AF-104 selection |
| Action lead | “First investigative priority: authentication and session control” / “Exact cause unresolved” with the relevant supporting observations |
| Unsupported source | Name the missing controller/AAA/client/service evidence, not a generic refusal; offer a scoped request draft |

Example numbers above describe verified existing selections or reference reconciliation examples. The implementation must calculate displayed values for the active dataset and cutoff, not embed these examples as runtime truth.

### Shared state and accessibility contract

| State | Visible behavior | Required test |
|---|---|---|
| Loading | Skeleton only in changing region; requested scope and stable controls remain visible | Change scope during a delayed request without losing focus or selecting stale data |
| Empty | “No matching observed events in this covered window” | Empty filter does not assert no problem or healthy service |
| Partial | Available findings plus missing sources/windows and qualified totals | A partial chunk response cannot masquerade as full membership |
| Error | “Evidence could not be loaded. No conclusion about this selection is available.” Preserve filters and Retry | Retry requests the same context; no zero count substituted |
| Previous result | Clearly labelled prior scope and window, non-current | Failed refresh cannot display the old result as the new answer |
| Unsupported | Name the absent processing capability | Distinct from source unavailable, no matching events and replay withheld |
| Stale response | Discard on context mismatch | Out-of-order scope/filter/cutoff responses never overwrite the active result |
| Answer pending | New question visibly supersedes old answer; retain draft if failure | Presets and free text cannot leave the prior reason-code answer appearing current |
| Replay update | Play/pause/seek controls retain DOM identity or equivalent focus stability | Keyboard pause works while counts update; no future evidence appears |
| Drawer | Named heading, contained keyboard focus, Escape and return focus | Frame links and next/previous preserve selection and scroll |
| Narrow screen | Stacked interpretation and readable evidence cards | Verify 1024 × 768, 768 px and 390 px widths without covered controls or clipped meaning |

Use proper tab semantics and arrow-key behavior for actual tabs. Scope buttons, disclosure controls and filters must have unambiguous accessible names. Meaning cannot depend on hover or color. Test keyboard-only operation, 200% text zoom and reduced motion as well as pointer interaction.

### Existing file integration map

Paths are relative to the airframe repository. These are verified existing integration targets, not files modified in this planning task. The current UI has no separate src tree; its modules live under dist/js.

| Implementation area | Existing targets |
|---|---|
| Contract and service schema | contract.md; docs/implementation-interface.md |
| Safe evidence preprocessing | scripts/build_evidence.py; scripts/analyze_pcaps.py; versioned generated manifests and chunks |
| Async scope queries and derived projections | dist/js/service.js |
| Route, scope, context admission and shared drawer | dist/js/app.js; dist/index.html |
| Factory queue, preview and coverage | dist/js/factory.js; dist/styles.css |
| Investigation stages, history, patterns and interpretation | dist/js/investigation.js; dist/workspace.css |
| Requests, validation boundaries and anchor rail | dist/js/action.js; dist/workspace.css |
| Shared tokens, focus and responsive layout | dist/shell.css |
| Projection, privacy, component and regression verification | tests/service.test.mjs; tests/static.test.mjs; tests/ui.test.mjs |

Before a build swarm starts, assign one owner to each shared stylesheet and the shell/service interfaces. Feature agents must not independently redefine scope, drawers, replay state or aliases. P0 UI completion depends on real sanitized evidence projections: unsupported placeholders are useful interim states, not acceptance of the remediation.

## 11 Recommended next implementation boundary

Adopt the proposed contract and service schema first, then build the P0 evidence foundation and three-surface workflow. Add the P1 drawers without delaying core authentication/recurrence discovery. Finish with the component matrix and a new blind engineer who has not seen this plan or the report. The success criterion is the engineer’s independently justified diagnostic priority, broader pattern discovery and correct uncertainty—not merely all buttons responding.

This document is ready to guide a later implementation request. No deployment or production integration is authorized by the planning task itself.

## Sources

- AIRFRAME Blind Shop Floor Assessment, 25 September 2026, including the locked tool-only engineer log and separate post-report debrief.
- User-supplied Airframe Wireless PCAP Pressure Test Report, findings F01–F11; no fresh raw-capture re-audit in this planning task.
- Existing contract.md and docs/implementation-interface.md, inspected read-only for current scope and architecture.
- Technical PM and UX agent cross-review, followed by the UI agent’s deployed-interface inspection.

No application code, existing contract, dataset or deployed site is changed by this plan.
