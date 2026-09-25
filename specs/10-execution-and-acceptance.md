# M10 — Future swarm execution and acceptance

This is a future build plan. No swarm is started by this document. The initial delivery includes M01–M08 plus integration; M09 remains a deferred design boundary.

## Read and work protocol

Every future agent reads the master contract, data ledger, this plan, its module and direct dependency specifications before editing. Inspect the existing worktree and preserve unrelated changes. Record implementation assumptions and interface questions before building. One integration owner chooses the framework and shared source boundaries; do not create parallel scaffolds.

Module ownership is exclusive for implementation files. Shared schema, alias rules, operation signatures, clock semantics and design tokens require owner review before change. Request a contract amendment describing the motivation, affected consumers, migration and test updates. Resolve disagreements against observed data and master invariants, never by making fixtures match a desired screenshot.

## Delivery waves

| Wave | Work | Entry gate | Exit gate |
|---|---|---|---|
| 0 | Integration setup; audit ledger; lock framework and interfaces; identify reusable prototype assets | User authorizes build | Written decisions, clean ownership map, baseline inventory and known defects |
| 1 | M01 data foundation; M05 tokens/components independently | Shared schema and aliases agreed | Full provenance/index fixture; accessible component gallery |
| 2 | M02 replay; M03 initial rules; M04 boundary incrementally | M01 normalized observations | Deterministic prefix projections and complete AF-104 selections |
| 3 | M06, M07 and M08 screen work in parallel on frozen M04 fixtures | Projection contract and M05 primitives stable | Three functional screens, truthful states, no private domain logic |
| 4 | Cross-module integration, temporal/privacy/accessibility/performance tests | Modules pass own tests | Acceptance matrix passed; defects triaged and blocking defects closed |
| 5 | Demo rehearsal and release record | Integrated candidate | Reproducible local run, verified script and explicit limitations |

M03 may develop against M02 fixtures but cannot sign off causal behavior until integrated replay passes. M04 may use contract-shaped fixtures during construction; fixtures must be tagged synthetic and cannot become demo facts. Screen agents may not substitute hard-coded findings when a service operation is unfinished.

## Required agent handoff

Each handoff lists owned/changed files, contract versions, implemented operations/states, tests and actual results, dataset hashes, known limitations, unresolved decisions, migration implications and next consumer. Include screenshots for UI modules and reproducible evidence membership for data modules. “Done” without verification artifacts is not a passed gate.

## Acceptance matrix

| ID | Test | Pass condition | Owner |
|---|---|---|---|
| DATA-01 | Input integrity | Eight hashes, bytes and record counts match ledger, or discrepancy documented before use | M01 |
| DATA-02 | AF-104 anchors | Original frame ordinals, microsecond times, roles, reason/status and source match | M01/M04 |
| DATA-03 | Complete membership | 46 retry responses and 10 client probes with exact scoped selection and source distribution | M01/M04 |
| DATA-04 | Missing/malformed data | Explicit parse/missing state; no fabricated zeros or dropped provenance | M01 |
| TIME-01 | Prefix causality | Running full capture to cutoff equals processing only available prefix | M02/M03 |
| TIME-02 | Speed equivalence | 1×, 5× and 20× yield identical projections at identical cutoffs | M02 |
| TIME-03 | Seek reversal | Backward/forward seeks reproduce results; stale requests cannot overwrite state | M02/M04 |
| TIME-04 | No hidden hindsight | Tables, assistant, exports, labels and deep links reject future evidence | M04/M07/M08 |
| DET-01 | Scoped detection | Independent clients/sources do not suppress each other; warmup and gaps explicit | M03 |
| EVID-01 | Citation integrity | Every displayed observed/derived claim resolves to exact frame or selection | M04 |
| EVID-02 | Count semantics | Observation, viewpoint, visible row and grouped-transmission counts stay distinct | M04/M07 |
| UX-01 | Two-selection journey | Factory investigation opens workspace; action brief opens with context intact | M05–M08 |
| UX-02 | Visual fidelity | Approved hierarchy, proportions, restrained palette and architectural aesthetic retained | M05–M08 |
| UX-03 | Spatial honesty | Layout disclaimer persistent; geometry changes never change inference | M06 |
| UX-04 | Accessibility | Keyboard journey, focus return, contrast, reduced motion and 200% zoom pass | M05–M08 |
| VAL-01 | Honest validation | Insufficient exposure inconclusive; offline comparison never claims physical fix | M08 |
| PRIV-01 | Identity boundary | No raw addresses, raw captures or restricted registry in standard UI/export | M01/M04/M08 |
| RES-01 | Failure recovery | Missing files, corrupt partition, storage denial and stale cursor remain recoverable | All |
| PERF-01 | Measured performance | Hardware/browser/build and dataset documented with startup/query/seek measurements | Integration |

For DATA-03 verify membership, not only matching totals. For TIME-01 test cutoff immediately before and after each anchor and around the five-second watch threshold. For TIME-04 inspect rendered and hidden/accessibility content as well as operation responses.

## Fixture inventory

Real fixtures: eight source manifests, three AF-104 anchors, complete 46/10 selections, exact interval, source channel map, known unknowns. Synthetic fixtures, separately labeled: malformed frame, missing field, clock ambiguity, duplicate delivery, late arrival, empty prefix, unrelated concurrent clients, dense same-time events, invalid cursor, storage failure, insufficient validation exposure. Never mix synthetic observations into the supplied-capture dataset.

## Demo script

First 30 seconds: show the approved-style overview with “Historical review” and illustrative-layout label; select AF-104; open the workspace; point to the captured deauthentication and later successful association response, 13.127 seconds apart; immediately show “Cause unresolved” and explain that the product separates evidence from speculation.

Next: inspect S03-5099; open the complete retry-response selection; show the eight viewpoints and distinguish the three client-probe sources. Enter replay from before the opening event and demonstrate progressive discovery without final-duration leakage. Open the action brief, show controller-log follow-up and save a validation plan or valid offline comparison. Export a pseudonymized brief.

Do not stage a live sensor outage, successful physical fix, worker journey or euro savings as measured results. The business narrative may reference the user-provided production-risk scenario, explicitly as context, not an incident-cost calculation.

## Release gate and scope cuts

Block release for fabricated facts, hindsight leakage, broken citations, identity leaks, nonfunctional primary navigation or validation falsely claiming repair. Cosmetic imperfections may be documented if they do not impair legibility or meaning. If time is short, cut free-text questions, optional animations, elaborate illustration detail and additional curated cases before cutting evidence completeness, replay correctness or uncertainty labels.

The release record states what actually passed, what is deferred, how to run the local deliverable, data origins, versions and limitations. “Production-ready” requires the security/operational work in M09 and independent deployment qualification; an attractive hackathon prototype must not be labeled production-ready merely because the UI is complete.
