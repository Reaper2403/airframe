# AIRFRAME 2.0 — Release verification

Build date: 2026-09-25. Delivery classification: functioning, evidence-grounded offline/replay prototype; not production-qualified industrial monitoring.

## Team and scope

Three implementation workers owned data/service, factory/design-system, and investigation/action modules. The root agent owned integration, the application shell and browser testing. All three approved screen compositions were implemented as interactive interfaces, not flattened screenshots. M09 live integration remains deferred as specified in the plan.

## Automated results

The final candidate passes 19 service/parser/static tests and 31 browser interaction scenarios. The browser suite runs against the real local app in headless Google Chrome, at 1600 × 1000, 800 × 600 and 390 × 844. Screenshots of all three surfaces were visually reviewed. No unexpected browser runtime exceptions remained.

| Area | Exercised behavior |
|---|---|
| Factory | All three cards, eight AP context panels, panel open/close, search, source/state filters, empty results, clear filters, zoom in/out/reset, pointer and keyboard pan, mobile map collapse |
| Navigation | Main tabs, factory-to-investigation, action open/close, browser back, all three deep links, invalid incident recovery |
| Evidence | Three exact AF-104 anchors, frame modal and provenance, table links, related links, all selections, source filtering, all 46 retry observations across five pages, previous/next pages, selection definition |
| Timeline | Singleton event, count-preserving dense bins, exact bin membership, member selection, close group and focus return |
| Replay | Play/pause, restart, slider, 1×/5×/20× controls, previous/next event, seek to frame, pre-opening empty state, post-association result, backward removal of future facts |
| Questions | Both suggestions, typed submit/Enter, unknown-question fallback, exact citations, prefix-limited duration answer |
| Action | Source filter, event selection, full provenance, snapshot freeze and explicit refresh, all plan fields, required-field validation, save/reload, inconclusive comparison, actual downloaded export |
| Resilience | Missing bundle with retry/recovery, corrupted bundle integrity rejection, blocked browser storage with retained draft/export, invalid deep link, no-future-evidence export |
| Accessibility | Visible-control accessible-name audit, keyboard AP activation/pan, modal focus containment and return, reduced-motion execution, narrow layout without horizontal page overflow |
| Privacy | No raw MAC identities, PCAPs, identity registry, SQLite store or legacy public-data directory in deployed output |

The browser report records each scenario and inventories visible controls on representative desktop/mobile states. This is repeatable regression coverage of every implemented component category, not a mathematical proof against every possible input or a full assistive-technology certification. Safari/Firefox, a real screen reader, and genuine browser/text zoom still need separate qualification; the 800 px test is a reflow check, not a claim those audits occurred.

## Verified data results

- All eight original capture SHA-256 hashes match the data ledger.
- Complete local ingestion: 1,118,853 records, 286,274,178 original PCAP bytes, 54,544 retry flags.
- AF-104: 13,126,884 microseconds; 46 retry-marked probe responses; 10 client probes. Exact frame and per-source memberships are tested.
- AF-105: 13,120,847 microseconds; 45 retry responses; 2 client probes.
- AF-106: 13,102,418 microseconds; 40 retry responses; 6 client probes.
- Complete capture detector audit: 1,426 disconnect episodes, 1,398 watch signals and 2 scoped retry bursts. These are rule-defined observations, not confirmed outages or unique production failures.
- Browser bundle: 562 observations in complete curated context windows. Complete normalized local store: approximately 1.2 GB, indexed and excluded from publication.

Bundle loading verifies byte length and SHA-256 against the partition manifest before constructing the service. This detects mismatched/corrupted artifacts; it is not a cryptographic authenticity claim against a malicious replacement of both files.

## Performance observations

On the current macOS host with Node 26.10.0, a 100-query local microbenchmark measured service construction at approximately 2.8 ms and 100-row evidence queries at 0.67 ms median / 0.82 ms p95. The complete offline detector audit ran in approximately 8.5 seconds. These are local measurements, not production throughput guarantees or browser network latency claims.

## Deliberate implementation boundaries

- The public UI presents three audited curated investigations. The full normalized store and whole-capture detector audit remain local; the site does not claim its three cards exhaust all capture events.
- Small curated replay projections are rebuilt deterministically from their eligible prefixes instead of maintaining complex persisted checkpoints. Optional global release ordinals resolve equal-timestamp visibility, and seek invalidates active generations. No full-file statistics drive replay findings.
- Correlated client context is retained without claiming synchronized duplicate transmissions, measured locations or worker movements. Unverified same-transmission observations are conservatively kept separate.
- Questions are deterministic, supported-intent evidence explanations. No external model, generated cause or fabricated citation is needed.
- The validation form saves a plan and evaluates available comparison prerequisites. Current evidence lacks verified comparable forward exposure, so comparison is explicitly insufficient/inconclusive. It cannot report a physical fix or start a live monitoring session.
- Identity, clock calibration, live transport, measured RF coverage, controller writes, production authentication/security hardening, 5,000-client load qualification and predictive-model validation remain outside this release.

The legacy browser-data directory was moved to local `data/legacy-public-bundle` so it cannot be served by the new site. It remains recoverable; original raw captures and read-only project sources were not changed.
