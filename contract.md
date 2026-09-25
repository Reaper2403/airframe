# AIRFRAME implementation contract

Version: 3.0 diagnostic amendment. Status: authorized local implementation, subject to release verification. Updated 2026-09-25. Earlier module prose remains the baseline except where this amendment explicitly supersedes it.

## Purpose and authority

Build the three approved AIRFRAME surfaces: Factory overview, Incident workspace, and Action brief. An engineer must move from an investigation on the illustrative floor to its evidence and next diagnostic step in two primary selections. The experience must remain calm, precise, and traceable to the supplied packet captures.

This contract governs all future implementation agents. MUST is an acceptance requirement. SHOULD permits a documented alternative with equivalent behavior. Existing prototype behavior is not authority. Document changes first when interfaces must change.

Authority order: explicit user instructions; this contract and the verified data ledger; module contracts; approved wireframes for composition; existing prototype as reference only. If observed packet evidence contradicts this ledger, record the discrepancy and revise the affected requirements before presenting the old finding. Never alter data to match a screenshot.

The user has authorized a local implementation swarm. This contract does not independently authorize production infrastructure changes or publication.

## Read order

1. [Data ledger](specs/00-data-grounding.md): verified facts, hashes, caveats, and screenshot corrections.
2. This contract: shared domain, temporal rules, operation semantics, ownership.
3. [Execution plan](specs/10-execution-and-acceptance.md): dependencies, delivery gates, handoff checklist.
4. The assigned module specification and its direct dependency specifications.

## Product boundary

The initial deliverable is an offline-capable replay investigation tool for this capture set. Historical review and replay are distinct modes. Historical review may show the entire completed incident. Replay may reveal only observations released by the replay clock. The interface MUST say which mode is active.

The factory drawing is illustrative. Actual AP and sensor coordinates, physical coverage, walking routes, operational asset roles, business impact, heartbeat, packet loss, and clock synchronization are unavailable. Map placement MUST NOT contribute to detectors, confidence, severity, or event grouping.

A successful association response establishes a protocol observation. It does not prove EAP completion, key establishment, IP connectivity, application recovery, or production restoration. The preferred label is “Association observed” and the duration label is “Deauth → association response.”

No application payload or layer-3 inspection. Passive protocol metadata only. Version 3 explicitly permits bounded EAP/EAPOL metadata parsing after parser/privacy fixtures pass: EAPOL version/type; EAP code, identifier and type; key message classification, key-information flags and replay counter. Identity strings, method bodies, keys, nonces, MIC bytes, SSIDs and application bytes are forbidden in public artifacts. Protected bodies remain uninterpreted. No automatic network changes, generated worker tracking, simulated fixes mixed into capture evidence, or calibrated confidence percentages.

## Version 3 diagnostic amendment

The three original episode APIs remain backward-compatible. The single service now also owns asynchronous, integrity-checked full-capture diagnostic projections. The original 562-frame selection is not the full capture; wider evidence is obtained through sanitized client-history partitions and bounded quality-membership chunks. Raw captures and the identity registry remain restricted locally.

### Evidence and interpretation

- Reason 23 establishes a reported IEEE 802.1X authentication failure, not an exact RADIUS, certificate, credential or lockout cause and not transmitter authenticity. Reason 2 reports previous authentication no longer valid.
- Open-system authentication requires algorithm 0. Association, enterprise EAP observations, key observations, protected traffic and application verification remain distinct. Observed M3 never fabricates missing M2. Later-state counterevidence applies to a claim, not a packet's observation state.
- Client history includes non-beacon observations involving globally aliased unicast non-AP addresses. C aliases have recognized client roles; A aliases retain uncertain role. Multicast addresses are never client-population members. Completeness means published predicate membership, not lossless capture or validated sensor health.
- Capture patterns group qualifying reason-code observations. Counts distinguish termination observations, unique client aliases and clients meeting the recurrence rule. A pattern is not a shared-cause diagnosis.
- Recurrence uses at least three reason-2 terminations for a client/BSSID/source in an inclusive five-minute recorded-time window. It is an observation rule, not a physical-time or service SLA claim.
- Quality rules expose exact provenance and metric restrictions. Within-source timing validity is separate from cross-source alignment. Invalid rates cannot produce airtime/utilization. Snapshot-length anomalies retain safely bounded records and disclose permissive handling.
- Quality summaries may expose a labelled lower bound in replay until the boundary partition loads. They MUST expose countExact and countLabel; a lower bound cannot appear as an exact total. Quality details provide exact prefix count and stable paginated members.
- Retry ratios count retry-marked probe-response observations divided by all probe-response observations in the selected client/window/transmitter/source scope. They are not packet-loss rates. Candidate original/retry pairing has explicit matching fields and uncertainty; missing ACK is not proof of loss.
- Inventory means observed BSSID aliases, not physical AP count or expected inventory. Qualified signal-comparison leads use client-transmitted sensor RSSI only and require actual AP/client roaming evidence before diagnosis.
- Association does not verify security or service. External evidence requests are unsent drafts. Required unavailable checks keep validation inconclusive.

### Delivery and replay

The existing manifest pins the diagnostic index SHA-256. The index pins client, quality-metadata and frame artifacts; quality metadata pins bounded member chunks. Content is verified before publication to a projection. Source provenance is independently preserved. All asynchronous results carry active dataset/version/cutoff/ordinal/generation; obsolete generations are rejected and the shell also rejects obsolete scope/filter responses.

File bounds and known metadata are not online-health evidence. Event-derived quality triggers, pattern members, stage observations, inventory-source appearances and signal candidates are admitted by cutoff plus release ordinal. Historical review may access the completed sanitized corpus; replay may not expose future conclusions from it.

See docs/implementation-interface.md for exact version 3 operation names, scope definitions, state enums, predicates and limitations. Tests and independently recomputed audits—not screenshot or report constants—gate release.

## Module ownership and dependencies

| ID | Module and specification | Owns | Depends on |
|---|---|---|---|
| M01 | [Capture ingestion](specs/01-ingest-and-provenance.md) | Input manifest, parser, normalized observations, role/alias mapping, field coverage | Shared contract |
| M02 | [Replay and protocol state](specs/02-replay-and-state.md) | Event release, deterministic clock, protocol episodes, seek/checkpoints | M01 |
| M03 | [Correlation and detectors](specs/03-correlation-and-detection.md) | Observation grouping, online features, signals, episode transitions | M01, M02 |
| M04 | [Incident service and evidence](specs/04-incidents-and-evidence.md) | Incident revisions, snapshot projections, operation boundary, evidence queries, explanations | M01–M03 |
| M05 | [Design system and navigation](specs/05-design-system-and-shell.md) | Tokens, shared controls, routes, mode badges, accessibility, selection state | Shared contract; M04 boundary |
| M06 | [Factory overview](specs/06-factory-overview.md) | Illustrative floor, incident rail, selection, source strip | M04, M05 |
| M07 | [Incident workspace](specs/07-incident-workspace.md) | Sequence, raster timeline, replay controls, evidence browser, contextual questions | M02, M04, M05 |
| M08 | [Action and validation](specs/08-action-and-validation.md) | Action brief, validation records, export, local persistence | M04, M05; invoked by M06/M07 |
| M09 | [Live bridge and scale](specs/09-live-and-scale-design.md) | Later live adapter, trust measurements, durability and storage design | M01–M04; deferred from initial build |
| M10 | [Integration and acceptance](specs/10-execution-and-acceptance.md) | Cross-module fixtures, verification gates, demo script, release record | All delivered modules |

Planned source boundaries use these module names. They are proposed ownership boundaries, not directories that already exist. M05 owns shared UI primitives. M04 owns transport and shared projections. A module agent MUST NOT silently create a second store, alternate event schema, independent clock, or competing alias registry.

The first implementation should preserve a modular monolith: local preprocessing plus one frontend and a transport-independent data service. Prefer a locally served processed bundle for the initial build. M09 may later introduce a server without changing semantic contracts. Static UI delivery must contain no raw PCAPs or identity mapping. Framework selection belongs to the initial integration task, with preservation of useful existing assets and no parallel competing scaffolds.

## Universal data rules

| Rule | Required behavior |
|---|---|
| Time | Store source event time as integer epoch microseconds; display UTC with milliseconds, expose microseconds in details. Never derive precision from a rounded float. |
| Serialization | Epoch microseconds fit safe integer range for this dataset. Reject out-of-range numeric values; a future wider time format requires a schema revision. |
| Unknown values | Use an explicit unknown state or null with a missing reason. Zero is a real value. Never substitute zero signal, zero clock error, or false healthy status. |
| Units | Frequency MHz; channel integer; signal/noise dBm; rate Mbps; durations microseconds internally and seconds in display; counts integers. |
| Provenance | Every observed fact points to immutable capture identity and original one-based frame number. Every aggregate has a reproducible selection definition and full membership access. |
| Identity | Dataset-scoped stable aliases in all standard views and exports. Raw MAC mapping remains local/restricted. No names, device classes, or roles inferred from appearance or OUI alone. |
| Idempotence | The same capture and record cannot create a second observation on retry. The same event release cannot apply a second state transition. |
| Simulation | Illustrative geometry and synthetic test fixtures have distinct origins. They never change observed incident counts or evidence grades. |
| Counts | Distinguish observations, canonical transmission candidates, episode members, curated references, and visible rows. Never label one as another. |
| Versioning | Dataset, schema, parser, detector configuration, alias registry, and projection versions travel with every replay and export. |

## Shared entities

Field names below are normative conceptual contracts, expressed in prose rather than implementation code. A transport may encode them differently only with one documented, lossless mapping owned by M04.

### DatasetManifest

| Field | Type and semantics |
|---|---|
| dataset_id | Stable opaque identifier for an ordered set of capture hashes; not a display title |
| schema_version / parser_version | Required version identifiers |
| origin | supplied_capture, live_capture, or synthetic_test |
| captures | Ordered CaptureSource records |
| observation_count / rejected_record_count | Independently accounted counts; rejected records retained in diagnostics |
| source_time_bounds | Minimum/maximum recorded time; not proof of synchronization |
| field_coverage | Per-field present/missing/unsupported/malformed counts |
| alias_registry_version | Required for reproducible labels |
| limitations | Machine-readable reason identifiers with user-readable explanations |

### CaptureSource

| Field | Type and semantics |
|---|---|
| capture_id / sha256 | Content identity; hash checked before evidence lookup |
| source_id / display_name | Stable S01–S08 labels for this set, not surveyed physical coordinates |
| file_name / byte_length / record_count | Original input metadata |
| link_type / timestamp_resolution | Radiotap 127 and microsecond resolution for current set |
| first_event_us / last_event_us | Recorded bounds |
| observed_frequencies | Values and counts; do not hard-code only one frequency for future files |
| trust | Health, clock, loss, channel coverage, and measurement provenance; unknown for unmeasured fields |
| location_ref | Null for current set; future surveyed mapping separate from illustrative layout |

### Observation

| Field | Type and semantics |
|---|---|
| observation_id | Capture hash plus original frame number, unique across datasets; UI short form S03-5099 |
| capture_id / source_id / frame_number / file_offset | Required provenance; frame number is original record ordinal even after parse failures |
| event_time_us / ingestion_time_us | Recorded source time; ingestion nullable for historical captures. Replay release time is separate. |
| timestamp_uncertainty_us | Nullable measured bound; unknown MUST NOT become zero |
| frame_type / frame_subtype | Numeric values plus controlled labels |
| address_roles | TA, RA, SA, DA, BSSID aliases, each nullable and derived using frame type and DS bits |
| sequence_number / fragment_number | Nullable, valid only for applicable frame layouts |
| retry / protected / to_ds / from_ds | Decoded flags, nullable if header invalid |
| duration_id_raw / duration_interpretation | Raw 16-bit field and applicable interpretation; not always airtime |
| frequency_mhz / channel / signal_dbm / noise_dbm / rate_mbps | Radiotap metadata; nullable independently |
| auth_algorithm / auth_transaction / status_code / reason_code | Applicable management metadata, with decode availability |
| qos / phy / eap_metadata | Optional verified header-only details; unsupported until parser can validate them |
| parse_state / missing_reasons | Valid, partial, unsupported, or malformed; diagnostic reason list |
| header_reference | Local bounded header evidence pointer; no application bytes in public bundle |

### CorrelationGroup

Required: group_id, member_observation_ids, correlation_kind, rule_version, matching_fields, temporal_basis, and limitations. Kind is same_transmission_candidate or client_episode_context. Same transmission candidates require compatible channel and header fingerprint plus defensible temporal tolerance. Cross-channel context MUST NOT imply duplicate observation of one transmission. Original observations are never deleted by grouping.

### ProtocolEpisode

Required: episode_id, client_alias, relevant_bssid_aliases, opening_observation_id, current_state, first_event_us, last_visible_event_us, source_ids, transition_history, visibility_gaps, and version. State includes disconnect_observed, probe_activity_observed, auth_success_observed, association_success_observed, and observation_window_ended. Missing request frames do not invalidate a captured response; they reduce sequence completeness. Multiple contexts for one client must not overwrite one another.

### DetectorSignal

Required: signal_id, episode_id or scoped entity, detector_id/version, emitted_at_event_us, emitted_at_release_ordinal, input_cutoff, trigger_definition, triggering_observation_ids, metric numerator/denominator/unit/window, baseline state, evidence limitations, and disposition. Disposition is observation, watch, or investigate. Explicit measured service failure is not inferred from duration alone.

### IncidentRevision

Required: incident_id, revision, episode_ids, opened_at, detected_at, analysis_cutoff, lifecycle, factual_summary, implicated_entities, evidence_membership, metric_definitions, completeness_grade, hypothesis_grade, limitations, and next_check_id. Display alias AF-104 is a curated bookmark, not detector allocation order.

Lifecycle: observing → investigating → association_observed or unresolved_at_end. Acknowledgement and analyst closure are separate workflow fields. Association does not auto-close an investigation as “fixed.” Revisions are append-only. A frozen triage snapshot references one revision; later evidence appears separately.

Completeness is strong/partial/weak with reasons. Hypothesis is supported/plausible/unresolved with reasons. Current AF-104 defaults to partial and unresolved, because full exchange visibility, source health, and cross-source clock bounds are unverified. Source count alone does not raise causal confidence.

### EvidenceSelection

Required: dataset_id, revision/cutoff, selection_id, predicate_description, source/time bounds, eligible_count, returned_count, pagination_cursor, and stable sort. Summaries expose membership lazily but must resolve every member. A subset shown in a table is not the supporting population for a total unless explicitly equal.

### ReplaySession

Required: session_id, dataset/config versions, mode, event_cursor_us, release_ordinal, speed, status, analysis_generation, and checkpoint_ref. Mode historical_review permits full-dataset access. Mode capture_replay gates all evidence/summary operations by cursor and release ordinal. Speed is 1×/5×/20×; detector windows always use event time. Seek changes analysis_generation and cancels stale projections.

### LayoutManifest

Required: layout_id, version, origin=illustrative, normalized geometry, named display zones, decorative stations, explicit alias placements, and persistent disclosure. Coordinates are dimensionless. Zone names and AP placements are authored presentation data. No meter scale, claimed factory name, geographic north, RF coverage boundary, or worker route without supplied evidence. An incident can have no placement and must still be accessible in the rail.

### ValidationRun

Required: validation_id, incident_revision_ref, origin, status, analyst_change_note, baseline_window, forward_window, exposure_requirements, success_criteria, abort_condition, recorded_observations, limitations, and conclusion. Origin is offline_comparison, live_observation, or simulated_demonstration. Status is draft, running, insufficient_evidence, completed, or stopped. Conclusion is criteria_met, criteria_not_met, or inconclusive. Never output “causally fixed.”

## Service operations

M04 owns a transport-neutral operation boundary. All result-bearing operations include dataset/config version, analysis cutoff, mode, analysis generation, and limitations. Errors include a stable reason and retryable flag. No partial result silently masquerades as complete.

| Operation | Input | Result and side effect |
|---|---|---|
| Open dataset | Dataset ID | Validated manifest, aliases safe for UI, capabilities; local read |
| List investigations | Cutoff, filters, sort, cursor | Paged visible incident projections with total and cutoff |
| Get incident | Incident ID, revision or current cutoff | Frozen revision or latest eligible projection |
| Query evidence | Incident/selection ID, source/type filters, page cursor | Stable sorted observations and membership total |
| Get frame | Observation ID plus active cutoff | Header fields, provenance, parse limitations; no future access in replay |
| Get source context | Source IDs plus cutoff | File-derived metadata and explicit trust unknowns |
| Control replay | Play, pause, seek, speed, restart | New session state; seek increments generation |
| Get contextual answer | Supported intent, incident revision, cutoff | Factual text, exact citations, limits; no external action |
| Create/update validation | Incident revision, plan, origin | Local record, then forward observation if evidence exists |
| Export brief | Incident revision and included evidence selection | Pseudonymized downloadable report plus manifest; no raw PCAP upload |

Expected errors: dataset_missing, capture_hash_mismatch, unsupported_format, parse_incomplete, evidence_unavailable, outside_replay_cutoff, stale_generation, invalid_filter, storage_unavailable, and validation_requires_future_exposure. Timeouts show an explicit retriable state. Navigation must work after an error.

## Temporal and evidentiary invariants

1. Recorded cross-source order is a display convention when clocks are unverified. Determinism does not prove physical order.
2. Stable replay sort: recorded event time, source ordinal S01–S08, original frame ordinal. No implicit browser clock ordering.
3. Same-source deauth-to-association interval for AF-104 is 13,126,884 microseconds, displayed 13.127 s. It is recorded protocol elapsed time, not measured application downtime.
4. Final AF-104 counts are retrospective selections in a recorded-time interval. Before the ending frame is released, no final duration, successful endpoint, or final count may appear in replay.
5. Curated historical navigation is allowed to select a known case. It does not establish online detection. The UI must label historical and replay modes separately.
6. Failure to observe a response cannot become a timeout diagnosis without evidence that the relevant channel and capture process were adequate. Current unknown trust restricts such output to “not observed in available captures.”
7. Matching MACs relate address-level behavior, not verified worker identity. Distinct aliases do not prove distinct physical devices.
8. Sensors contributing AP responses do not necessarily observe client-transmitted probes. AF-104 has eight response viewpoints and client probes on three sources.

## Visual direction and binding

User-approved creative latitude: author a plausible, visually rich factory floor with consistent relative placement of production cells, aisles, logistics, test areas, AP aliases and selected client context. Survey-grade accuracy is not required. This is designed spatial context, not spatial evidence extracted from the captures. Keep one readable “Illustrative layout · placements estimated” label; do not clutter every object with repeated warnings. Relative placement may improve storytelling and navigation but must not imply measured distance, coverage, movement or root cause. Data-derived logical relationships and creatively assigned physical positions must remain separately modeled.

The approved PNGs are visual references only:

- [Factory overview](design-concepts/01-factory-overview.png)
- [Incident workspace](design-concepts/02-incident-workspace.png)
- [Action brief](design-concepts/03-action-brief.png)

Preserve their hierarchy, obsidian surfaces, architectural floor aesthetic, amber selection, blue evidence accents, restrained green association state, and left-context/right-action compositions. Replace their incorrect incidental labels using the data ledger. Do not paste a screenshot as a functioning interface or use fabricated timeline rows as fixtures.

## Done means

The user can select a curated investigation, read the evidence sequence, open any cited frame, understand what remains unknown, and save an action/validation plan. Replay is deterministic, prefix-causal, and reversible by seek. All three screens are keyboard-usable and responsive. Observed data and illustrative layout are visibly distinct. Every displayed finding resolves to raw-header provenance. M10 gates must pass before any production-readiness claim.
