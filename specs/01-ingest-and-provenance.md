# M01 — Capture ingestion, identity, and provenance

Read [contract](../contract.md) and [data ledger](00-data-grounding.md) first. Owner: ingestion agent in a future build. Output: verified normalized evidence; no UI interpretation.

## Inputs, outputs, and ownership

Inputs are the eight immutable PCAP files, expected hashes, a parser version, and an alias registry. Outputs are DatasetManifest, CaptureSource records, all supported Observation records, a frame-offset index, field-coverage statistics, rejection diagnostics, a restricted identity mapping, and browser-safe processed evidence partitions.

Own the future ingest module and preprocessing fixtures. Do not edit source captures, UI components, incident labels, or detector thresholds. Never overwrite legacy outputs during an exploratory run. Generate a versioned artifact and promote it through integration after verification.

## Record and parser behavior

1. Validate file existence, hash, magic, endianness, link type, timestamp resolution, and record lengths before interpretation.
2. Count every original record. An invalid record still consumes its frame ordinal, preserving S03-5099 lookup stability.
3. Store exact source timestamp components as integer microseconds. Preserve raw caplen and wirelen for truncation diagnostics. Recorded caplen smaller than wirelen is expected in header-only data; it does not automatically mean corruption.
4. Decode radiotap presence words, extension bits, alignment, and length. Unknown field layouts must not shift later decoded fields. Prefer a mature decoder; if partial support is unavoidable, terminate unsafe decoding and report unavailable fields.
5. Decode 802.11 type/subtype and flags, then choose header layout. For data, derive TA/RA/SA/DA/BSSID using ToDS/FromDS. For WDS/four-address cases, do not manufacture a BSSID. For control frames, honor subtype-specific address presence. Decode QoS/HT fields only when enough bytes and flags support them.
6. Decode allowed management fixed parameters: authentication algorithm and transaction, association status, deauthentication/disassociation reason, current AP address in reassociation where present. Respect protection/encryption flags before interpreting a body.
7. Decode only agreed protocol headers. Do not traverse arbitrary payload dissectors. EAPOL support needs an explicit capability inventory and header-boundary decision before implementation.
8. Emit partial observations when useful fields are valid. Emit parse diagnostics when no safe frame semantics remain. Keep error counts separate from unsupported types.

Duration/ID is a protocol field, not total frame airtime. Noise is a recorded sensor field, not a verified spectrum survey. Legacy rate metadata is not a universal PHY throughput measure. Name these precisely.

## Identity and roles

Derive a BSS role from management-frame BSSID/transmitter relationships such as beacons and association responses. Derive client-address roles from applicable request/response direction and data DS semantics. Preserve a station with multiple or uncertain roles instead of forcing a category. Do not use vendor prefix as the classification rule.

Display aliases are stable within a dataset and versioned. Reserve C-004/AP-04 for verified AF-104 reference identities, with local mapping recorded in the ledger. Allocate all other aliases deterministically in canonical identity order, excluding reserved aliases. Broadcast is “Broadcast,” not a client. Multi-BSSID transmitters remain logically distinct unless supplied inventory provides a physical device link.

Browser-safe data, exports, screenshots, and diagnostic logs use aliases. Raw identity mapping remains in the approved local environment. Hashing or aliasing is pseudonymization, not a claim of irreversible anonymization.

## Evidence packaging

Retain the full normalized header set in an indexed local artifact. Provide browser-safe partitions by source and recorded-time range. Chunking must not split an observation or alter ordinal identity. The UI must not load 286 MB of raw PCAP data or scan all 1.1 million records on initial page load.

Each partition declares its version, source/time bounds, record count, content digest, and whether it contains all observations or a named selection. Sparse projections must never be named “all events.” Package raw-header byte extracts only through an explicitly bounded local evidence operation. Do not place arbitrary original packet bytes in the deployed static directory.

Every reference resolves to capture hash, file name, original frame number, record offset, and parser version. A hash mismatch fails evidence lookup visibly. A missing local PCAP may still permit cached normalized header review, labeled “Original capture unavailable for recheck.”

## Aggregate semantics

Frame-type totals count observations, including repeated transmissions and multiple capture viewpoints. Per-source retry totals count captured frames with retry flag set. An AP count requires BSSID semantics, not any value found in address 3. Client metrics distinguish frames transmitted by and addressed to a station. Signal summaries preserve transmitter identity and source, preventing AP RSSI from becoming client RSSI.

Historical inventory aggregates may cover the full capture. Replay aggregates must be generated by M02/M03 from released observations. M01 must provide metadata that prevents accidental use of end-of-file summaries in replay.

## Verification and acceptance

- Reproduce 1,118,853 original records, 286,274,178 PCAP bytes, and 54,544 retry flags; investigate rather than conceal discrepancies.
- Reproduce all eight input hashes and source/channel associations in the ledger.
- Independently decode S03-5099, S03-6132, and S03-6135. Compare exact microseconds, addresses/aliases, flags, subtype, sequence, reason/status, frequency, RSSI, noise, and rate.
- Reproduce 46 retry-marked probe responses and 10 client probe requests for the stated AF-104 interval, with complete observation IDs and source subtotals.
- Test malformed radiotap, truncated management parameters, protected bodies, little/big-endian fixtures, control layouts, all DS address combinations, and timestamp ties using clearly labeled synthetic parser tests.
- Confirm repeated preprocessing produces identical domain data. Generation timestamps may differ only outside hashed semantic content.
- Confirm no raw MAC strings, SSIDs, EAP identities, or raw PCAP paths leak into public projections.

Handoff includes manifest, field-coverage report, input hashes, parser limitations, anchor comparison, exact count membership, and artifact size/partition report. No downstream module may claim unsupported fields are available merely because the previous prototype listed them.
