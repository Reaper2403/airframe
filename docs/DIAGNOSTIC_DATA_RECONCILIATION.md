# Diagnostic data reconciliation

Updated 25 September 2026. These values were recomputed from the original hash-checked PCAPs and current versioned predicates; they are not constants used by the runtime. Reference figures come from the supplied Wireless PCAP Pressure Test Report.

| Finding | Recomputed result | Reference comparison |
|---|---|---|
| Reason 23 | 506 deauthentication observations; 63 unique client aliases; 8 sources | Matches |
| Reason 2 | 1,147 deauthentication plus 330 disassociation observations; 18 unique clients | Matches |
| Recurrence | All 18 reason-2 clients meet at least 3 terminations for a client/BSSID/source in an inclusive 5-minute recorded window | Matches affected population; detector predicate is explicit and is not a service SLA |
| EAP identity metadata | 1,692 Requests; 319 Responses; no captured Success or Failure metadata | Matches; identity contents never published |
| Key messages | M1 32; M2 5; M3 31; M4 5 | Matches |
| Four key messages | 5 bounded counter/order-matched sequences across 4 client aliases | Matches count; no MIC or service verification claim |
| Probe responses | 173,964 total; 54,484 retry-marked observations | Matches; distinct from 54,544 retry flags across all frame types |
| Invalid PHY metadata | 914,057 5 GHz beacons with rate below 6 Mb/s | Matches reported 1 Mb/s beacon population |
| Snapshot inconsistency | 6,678 included records exceed declared snapshot length | Matches; records retained with provenance and safe bounds |
| Observed BSSIDs | 53 | Matches; 29 physical/base AP identities are not derived from alias appearance |
| Non-AP unicast identities | 123 histories: 95 C aliases plus 28 A aliases with uncertain roles | Matches capture-wide non-AP population; 30 multicast A aliases excluded |
| Qualified sensor-signal leads | 4 candidates under a declared median comparison rule | Count agrees; no undocumented mapping to report hashes or confirmed sticky diagnosis |
| Timing anomalies | 614,862 adjacent capture-record pairs that are both beacons and have a nonnegative interval of at most 10 microseconds | Does not match report's 612,675. Do not silently force agreement. See below. |

## Timing predicate discrepancy

Current source counts are S01 115,710; S02 116,269; S03 64,199; S04 72,394; S05 86,532; S06 47,665; S07 46,072; S08 66,021. They count the later record of an adjacent pair where both records are beacons and the recorded difference is 0–10 microseconds inclusive. Exact member metadata and source/frame provenance are inspectable through the quality detail service.

The supplied report reports a different total and per-source totals for its beacon-pair finding. Alternate interpretations such as consecutive beacons with intervening non-beacons excluded from the comparison and a strict rather than inclusive boundary also produce different totals. The report's exact executable predicate was not supplied, and these interpretations did not reproduce every report subtotal. The numerical discrepancy remains explicitly unresolved; the underlying validity concern remains supported by independently inspectable impossible timing examples. No raw data or rule was altered to manufacture the report's number.

## Qualified signal leads

Current aliases C-011, C-022, C-076 and C-091 satisfy the implemented rule, with alternate-sensor median differences of 10, 10, 12 and 10 dB respectively. At least three client-transmitted observations are required on each compared source. The comparison source is that of the latest admitted association, not an assertion of current AP attachment. Whole admitted capture medians are not contemporaneous same-link measurements. Source positions are unverified; values may be quantized or static. The UI must request AP/client-heard signal and real roaming decisions before describing a sticky client or recommending changes. These aliases have not been joined to the report's hashes by guesswork.

## Delivery and integrity

The bootstrap diagnostic index is approximately 4.5 MB and quality metadata approximately 161 KB. The 123 history partitions contain 187,163 client-membership observations. An observation involving more than one eligible client may belong to more than one history; this is not a second original captured frame. Complete client histories and quality populations are fetched only when requested. Quality partitions contain at most 2,048 records; exact prefix counts load the boundary partition and page queries load their required partitions. In replay, an unloaded boundary produces an explicitly labelled lower-bound summary, not a final count.

The uncompressed diagnostic JSON corpus is approximately 274 MB. It is a complete static evidence publication, not the initial browser transfer. This measurement is not a production scalability or latency claim. Later columnar/transport compression is possible without changing evidence semantics; this release preserves inspectable JSON and bounded reads.

SHA-256 links the current bootstrap manifest to the diagnostic index, then client/quality/frame artifacts and bounded quality parts. Public artifacts contain allowlisted metadata only. The raw PCAPs and restricted identity registry were not altered. Obsolete generated multicast-history files were removed during regeneration and are reproducible; no source material was removed.

## Interpretation boundaries

No captured EAP Success is an observation, not proof that every authentication failed. Reason 23 reports the failure class, not an exact AAA component or lockout diagnosis. Association and protected traffic are not application success. Four key-message observations are not MIC validation or verified service recovery. A known capture validity issue restricts physical interpretation even when timestamp arithmetic is exact and within one source.
