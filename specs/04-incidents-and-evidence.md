# M04 — Incident service and evidence

Status: implementation specification. Authority: [master contract](../contract.md) and [data ledger](00-data-grounding.md).

## Responsibility

Provide the only read boundary between normalized evidence and presentation. Own incident revisions, evidence selections, explanatory statements, and transport-independent operations. Do not parse captures, invent detections, own the replay timer, or render screen components. Consumers must not read legacy JSON directly.

## Inputs and outputs

Inputs are M01 versioned observations and indexes, M02 released-prefix snapshots, and M03 signals and episode context. Output is a consistent projection envelope containing dataset ID, schema and projection versions, incident revision where applicable, mode, cutoff, release ordinal, replay generation, completeness, and limitations. A response must be internally consistent even when replay advances during computation.

Every request captures its projection context at admission. Each response identifies that context. The UI discards responses from old generations; it must never combine an old evidence table with a new incident summary. Pagination remains bound to the original context until explicitly refreshed.

## Incident identity and revisions

- Separate stable incident identity from mutable presentation order. AF-104 is a curated bookmark mapped to the verified opening observation, not the 104th result of a sort.
- Store detector-created identity deterministically from dataset, episode identity, and opening observation. Additional signals attach by explicit episode/context rules, never proximity on the drawing.
- Revisions are append-only and contain state, observed endpoints, metrics, evidence selections, explanatory claims, grades, rule versions, and reason for revision.
- Analyst acknowledgement and closure are separate annotations. Closing a case cannot change the observed protocol state or imply service restoration.
- A frozen revision remains readable. New evidence offers “Newer evidence available”; do not rewrite an exported snapshot.
- AF-105 and AF-106 may enter the curated list only after their anchors and complete selections are independently checked. Do not copy their screenshot metrics as fixtures.

## Operation semantics

| Operation | Required inputs | Required result and constraints |
|---|---|---|
| Open dataset | Dataset identity and manifest version | Validated availability, file integrity status, supported capabilities, recorded bounds; no inferred health |
| List investigations | Projection context, filters, sort, page size/cursor | Eligible incident summaries, filtered total, next cursor, whether list is curated or exhaustive |
| Get incident | Identity plus revision or active context | One coherent revision, grades, known/unknown statements, evidence selection references |
| Query evidence | Selection identity, context, validated filters, page cursor | Rows, full matching count, visible range, immutable selection definition and continuation |
| Get frame | Observation identity and context | Normalized header fields, source/frame provenance, missing reasons and parser limits |
| Get source context | Source identities and context | Recorded channels, capture bounds, loaded status, explicit unknown clock/health/location |
| Contextual answer | Supported intent, revision, context | Bounded answer with claim-level citations and limitations; unsupported-intent response otherwise |

Page size defaults to 100 and is capped at 500. Sort is recorded timestamp, source ordinal, frame ordinal. A cursor binds dataset, selection, filters, sort, generation, cutoff, and continuation position. Reject a mismatched cursor; do not silently restart and duplicate rows. Empty results are successful queries, not errors. Counts apply the same filters and cutoff as rows.

## Evidence selection definitions

AF-104 requires separate named selections: opening deauthentication; successful authentication response; successful association response; retry-marked probe responses addressed to C-004 in the ledger interval; client-transmitted probe requests in that interval; and broader episode context. Each selection records inclusive/exclusive boundary semantics, direction/address role, frame subtype, retry predicate, time basis, and source scope.

The response selection has 46 observations and the client-probe selection has 10 in historical review. Eight viewpoints applies to the former; three to the latter. A combined evidence table must use its own deduplicated observation membership count. Never describe eight curated rows as eight of 46 unless all eight belong to that exact selection.

An aggregate citation opens the reproducible selection; an individual citation opens the original frame. Display aliases do not replace immutable observation identity. Removed filters restore the previous selection, not an unrelated default query.

## Claims and contextual answers

Each statement has a category: observed, derived, hypothesis, or unknown. Observed statements cite frames; derived statements cite inputs and calculation/rule; hypotheses list supporting and contradictory evidence plus the missing discriminating evidence. Unknowns state the unavailable evidence rather than a probability.

Initial supported intents: summarize sequence; explain displayed duration; explain reason-code limitation; explain retry count; explain source coverage; identify next evidence needed. Use deterministic templates for the initial build. Free text may map to these intents but cannot invoke network changes or retrieve future observations. If no supported mapping exists, show suggested questions and an honest unsupported response.

For AF-104, say an AP-addressed transmitter sent a deauthentication frame and a successful association response to the same BSSID was later captured. Reason 23 is an observed code, not proof of interference, a roaming fault, or a controller decision mechanism. Any stronger identity/authenticity conclusion needs additional evidence. Cause remains unresolved. Do not turn open-system authentication success into enterprise authentication success.

## Errors, privacy, and verification

Use master-contract typed errors with recoverability, user message, and context. Missing or corrupt evidence disables its citation and names the limitation; it cannot leave an apparently verified claim unchanged. Restricted address mapping and raw captures must not enter browser bundles, standard export, analytics, or error logs.

Acceptance: exact AF-104 selection membership; pagination without gaps/duplicates; filters and counts agree; all claims resolve; stale-generation responses rejected; no post-cutoff frame accessible by guessed ID; frozen revision/export unchanged after later data; unknown queries cannot fabricate citations. Handoff includes operation inventory, error fixtures, selection definitions, and a claim-to-evidence audit.
