# M03 — Correlation, features, and detectors

Authority: [contract](../contract.md), especially temporal and confidence rules. Dependencies: M01 normalized headers and M02 released episodes. Owner: intelligence agent. Detectors are deterministic evaluators of explicit state and configuration. No hidden wall-clock calls, online network queries, or full-file feature access.

## Required detector set

Initial release supports three useful mechanisms, with different meanings. It must not invent three different failure classes just to fill cards.

| Detector | Emission and state | Severity and boundary |
|---|---|---|
| D01 Disconnect episode | Emit observation when applicable deauth/disassoc frame arrives; append probes, auth, association | Start as observation. Single deauth is not a failure. |
| D02 Recovery watch | At 5 event seconds after D01 with no observed association, emit watch; at the 20-second context boundary record unresolved observation | Configurable demo threshold. Say “No association response observed yet”; do not claim a verified outage. |
| D03 Retry observation burst | At least 12 retry-marked observations within an inclusive trailing 2-second window for source/transmitter/channel/frame-family scope | Watch/investigate candidate, not proved interference or packet-loss rate |

D01 completion updates the same episode. D02 must not create a second incident for the same episode. D03 overlapping D01 should attach a signal only when membership and entity context match. Independent bursts remain independent.

The five-second watch parameter is chosen for a demonstrable prefix-causal product behavior. It is not a verified service-level breach. The AF-104 watch would become eligible at recorded time 12:25:33.328446 if no eligible response has been released. Final counts and duration remain unavailable at this point.

Optional after the core gates: explicit rejection detection when a verified nonzero management status occurs. Current legacy status inventory does not supply such a demo case. EAP/handshake stalls, sticky clients, successful inter-BSSID roam, and channel contention diagnosis require additional field/support validation before enabling.

## Metric definitions

| Metric | Numerator/population | Required qualifiers |
|---|---|---|
| AF-104 retry response count | Probe-response observations with retry=true, RA=C-004, recorded time in [deauth, authentication response] | Captured observations; inclusive endpoints; unverified cross-source clocks |
| AF-104 probe count | Probe-request observations with TA=C-004 in same interval | Client-transmitted probes; three sources in audited interval |
| Viewpoint count | Distinct sources contributing members to a stated selection | Response sources and probe-transmission sources labeled separately |
| Recovery interval | Same-source association response timestamp minus opening deauth timestamp | Protocol elapsed time, not application downtime |
| Retry ratio | Retry-marked eligible observations / all eligible observations in same transmitter/source/channel/frame-family window | Include denominator and window; do not use only “notable” frames |
| Signal trend | Time series for one source plus transmitter and applicable channel | AP and client transmitters never pooled; no gap interpolation across missing coverage |
| Recurrence | Qualifying disconnect episodes for one address context in stated window | Does not prove separate physical clients or AP fault |

A ratio alert is deferred until full eligible populations are available. Proposed later default: >30%, at least 50 eligible observations, and >3× a prior baseline. Baseline excludes the current test window and requires at least five completed comparable windows; otherwise state warming_up. Use trailing one-second buckets and a configurable 60-second comparison horizon as a pilot starting point. Thresholds and warm-up are explicit versioned configuration, not copied into presentation-only code.

## Correlation behavior

Same-transmission candidate fingerprints include compatible frequency, subtype, TA/RA/BSSID where available, sequence and fragment, retry flag, relevant reason/status/auth parameters, captured header length, and safe normalized header digest. Radiotap values are per-source observations and excluded from the equality digest.

Timestamp tolerance is measured or configured with clear provenance. No measured clock bound exists here. Without a bound, label a match as candidate or keep observations separate. The old 8 ms result is a legacy heuristic, not an authoritative calibration. Chained temporal clustering must not bridge arbitrary distance through many adjacent frames; require a bounded cluster span.

Same-source retransmissions remain separate observations even if they share sequence values. Replay-counter and sequence rollover must not merge distinct episodes. ACK association is not implemented merely by nearest timestamp because ACK lacks sufficient identity to establish a unique match in all conditions.

Cross-channel context uses the same client-address identity, an open temporal episode, applicable transmitter/receiver relationship, and recorded-time context. It describes related behavior, not same-frame duplication or physical handoff. Never attach the nearest event belonging to another client to enrich a demo.

## Trust and grading

Current source trust is unknown where no measurement exists. File readability establishes ingestion success only. Frame density is not a drop-rate measurement. Overlapping file time ranges are not clock synchronization. For current AF-104 the default grade is partial evidence, unresolved cause, with strong direct support for the three same-source anchor observations.

Each grade records criteria met, criteria unknown, and conflicting observations. Additional sources do not mechanically increase cause confidence. Multiple affected addresses strengthen shared context only after time, identity, and source-fault alternatives are considered. No default alert calls an AP “failing” from one client episode.

## Alert consolidation and ordering

Incident identity derives from opening observation plus detector family and dataset, not transient sort order. Group signals by episode before presenting. Deduplicate repeat signal delivery. Rank by active explicit rejection or repeated pattern when present, then watch status and age; break ties deterministically. Production criticality is unavailable and must not influence initial ranking. Curated order is a separate “Demo investigations” selection and may pin AF-104.

D03 enters above threshold, updates while the condition persists, and clears only after two complete two-second windows below six retry observations. These initial hysteresis values are prototype parameters. A reset of one source/transmitter state cannot suppress another entity’s detection.

## Acceptance

- D01 opens on the deauth prefix before any future authentication is available.
- D02 emits at its configured event-time threshold with no future-peeking and correct trust caveat.
- AF-104 finalized membership reproduces the ledger’s 46/10 counts and per-source subtotals.
- One episode produces one incident containing multiple signals, not one incident per sensor.
- A normal successful synthetic roam does not become a failure merely because it contains deauthentication.
- Two independent transmitter bursts both emit; the legacy global suppression bug cannot recur.
- Sparse denominator, baseline warm-up, source silence, clock uncertainty, and sequence rollover test cases produce explicit limitations.
- Detector reasons explain every visible label and supply complete member IDs. Hard-coded 92% confidence is absent.

Handoff: detector parameter ledger, selection definitions, full membership fixtures, grading rationale, prefix tests, and documentation of disabled capabilities.
