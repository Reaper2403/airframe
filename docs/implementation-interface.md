# AIRFRAME implementation interface — 2.0

The browser loads `data-v2/bundle.json` and passes it to the named ES-module export `createService(bundle)` from `js/service.js`. All reads are synchronous after that initial fetch. The browser must never read the legacy data directory.

## Projection context

Every operation accepts a final context object with `mode` (`historical_review` or `capture_replay`), integer `cutoffUs`, and integer `generation`. Optional `releaseOrdinal` gates a prefix within an equal-timestamp group; ordinals are canonical positions in the complete source dataset, not subset positions. If omitted, every observation through the cutoff timestamp is released. Historical mode uses the complete packaged evidence; replay filters every observation by cutoff and ordinal. Results carry the admitted context. The shell alone owns the timer and generation. A mode switch or seek increments generation. All times are epoch microseconds.

## Operations

- `service.manifest`: dataset metadata, not live metrics. Fields: datasetId, schemaVersion, parserVersion, detectorVersion, aliasVersion, origin, firstUs, lastUs, observationCount, retryCount, byteLength, rejectedRecordCount, sources, limitations, capabilities. Source metadata has id, channel, frequency, recordCount, retryCount, byteLength, firstUs, lastUs, sha256, health=unknown, clock=unverified.
- `listIncidents(context)`: array of visible curated incident projections. `listInvestigations` is an equivalent alias. This is explicitly not the exhaustive detector result list.
- `getIncident(id, context)`: one projection, or null when opening has not been released. Unknown ID raises typed evidence_unavailable.
- `queryEvidence(id, filters, context)`: filters are selection (all, anchors, retry, probes), source (all or source ID), type (optional exact type), page (zero-based), pageSize (default 100, maximum 500). Result contains rows, total, returnedCount, page, pageSize, selection, predicate, context, nextCursor. Passing only nextCursor as filters.cursor restores the original filters and page size, advancing to the next page. Cursor binds all filters, page size, mode, cutoff, ordinal and generation; mismatches fail. All means complete client-context selection for that curated episode, not all capture frames.
- `getFrame(id, context)`: normalized observation or typed error, including outside_replay_cutoff. No future frame can be retrieved by guessing its ID.
- `getSources(context)`: capture-file metadata with unknown health/clock, never inferred online state.
- `answer(id, question, context)`: deterministic supported-intent response with text, citations (exact visible frame IDs), supported boolean, context. Unsupported questions get a bounded fallback.

Incident projection fields: id, title, client, ap, openUs, endUs (nullable), authUs (nullable), durationUs (nullable), retryCount, probeCount, viewpoints, probeViewpoints, evidenceGrade, cause, lifecycle, evidence (all visible context members), anchors (deauth/auth/association, each a visible frame or null), limitations, context, revision, observation, nextStep. A completed interval appears only after its association anchor is released. Counts stop at the authentication response, once observed, matching the independently audited selection. Earlier replay counts are prefix counts, never final totals.

Frame fields: id, observationId, source, frameNumber, fileOffset, captureHash, timeUs, type, frameType, frameSubtype, transmitter, receiver, bssid, sourceAddress, destinationAddress, channel, frequency, signal, noise, rate, sequence, fragment, retry, protected, toDs, fromDs, durationId, durationInterpretation, reasonCode, statusCode, authAlgorithm, authTransaction, parseState, missingReasons. All identities are pseudonyms. Capture hash and original record number resolve provenance. No packet bytes, raw identities or payloads are public.

The service also exports a pure `evaluateDetectors(observations, cutoffUs)` for D01/D02/D03 testing and local full-data evaluation. Curated navigation does not claim that three examples are the complete incident population. Immutable projection copies act as frozen snapshots; re-reading at a new cutoff creates a new revision reference.

## Local artifacts and limitations

`data/normalized-v2.sqlite` is the complete indexed normalized dataset, not part of the static delivery. `data/identity-registry-v2.json` is restricted local pseudonym mapping. The browser bundle is an explicitly declared complete selection for three verified investigation windows, not a replacement for the full capture store. EAP/PHY advanced decoding, clock calibration, measured sensor health, physical location, and application recovery are unsupported. Live transport and late-arrival corrections remain deferred M09 capabilities.

## Implemented data handoff — 2026-09-25

All eight original PCAP hashes were checked before decoding. The generated store contains all 1,118,853 original record ordinals, with zero rejected records, 286,274,178 input bytes, and 54,544 retry flags. Per-frame source, microsecond timestamp, file offset, capture hash and parser version are retained. The alias registry is owner-readable/writable only and excluded from static delivery. No source files were altered.

The three curated examples were each decoded and validated independently from raw capture records. AF-104 has 13,126,884 microseconds from S03-5099 to S03-6135, 46 retry-marked probe responses and 10 client probe requests. AF-105 has 13,120,847 microseconds, 45 responses and 2 requests. AF-106 has 13,102,418 microseconds, 40 responses and 6 requests. The 562-frame browser selection contains all client-related observations in each fixed 20-second context, including post-association observations; it is not the full captured dataset. Retry/probe metrics use their narrower, inclusive opening-to-authentication selection.

The same pure JavaScript detector engine was evaluated over all 1,118,853 normalized records in canonical order. The local audit contains 1,426 D01 episodes, 1,398 D02 watches and 2 D03 scoped retry bursts. These are configured observational rule results, not verified service failures. The first full evaluation took 8.49 seconds on the current host; this is not an end-to-end or production scalability claim. UI navigation deliberately presents only three verified curated examples.

Fifteen focused automated tests cover input totals/channels, exact anchor metadata, complete memberships, additional cases, strict temporal visibility, seek reversibility, immutable snapshots, pagination/cursor binding, citations, privacy and integrity errors, deterministic detector prefixes, normal roam, independent retry scopes and rearming, cross-BSSID context, equal-timestamp ordinal gating, and malformed/protected/DS/control/endian parser fixtures. Re-running preprocessing produced byte-identical semantic output before the subsequent intentional schema addition of global release ordinals.

Implementation choices: replay projections are rebuilt directly from a small complete case selection, so no checkpoint cache is needed for browser seek. Detector revisions are append-only in the full local audit; returned UI projection objects are independent snapshots. Same-transmission merging is deliberately disabled because no measured cross-source clock tolerance exists; observations remain separate. Late-arrival simulation, live adapters, calibrated ratio baselines, production persistence/security and an unrestricted full-capture browser remain outside the delivered prototype. No claim of physical repair or production readiness is made.
