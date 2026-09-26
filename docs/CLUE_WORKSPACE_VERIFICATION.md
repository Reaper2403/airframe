# Investigation workspace verification — 25 September 2026

This records the initial redesign. See [Incident report verification](INCIDENT_REPORT_VERIFICATION.md) for the subsequent network-engineer UI refinements and live OpenAI/PDF integration.

## Delivered scope

Only the Investigation screen was redesigned. The shared app shell now mounts that workspace on the investigate route and supplies its evidence service. Factory and Action brief modules, existing diagnostic service, and existing stylesheets match their pre-change SHA-256 hashes. Their entry and return paths were exercised in the browser. The original brief is explicitly separated from a newly selected comparison scope.

The screen provides a linked time/entity matrix (AP interface, channel, client, sensor), five named measurements, focus and peer comparisons, stage coverage, reason/protocol/status distributions, explainable clue highlights and recorded-interval histograms. Missing observations and unavailable measurements are not health verdicts. Exact matching frame references remain inspectable.

## Automated checks actually executed

The complete Node service/parser/static suite passed **53/53**. It includes 14 new clue-service tests, covering:

- Reconciliation of 187,163 unique published observations, exact membership and metric denominators.
- Unseen reason codes and recurrence intervals, shared windows, concentration and contrary later-stage evidence.
- Association-based client peers, excluding probe-only recipients from that cohort.
- Null versus zero, integer bin boundaries, source integrity failures and retry, and stale asynchronous generations.
- Timestamp plus release-ordinal replay, backward seeking before a requested interval, and prevention of future evidence in exported packets.
- JSON privacy, bounded handoff size, provenance and reproducible full-membership resolution.

JavaScript syntax validation also passed after the final UI refinement. Existing screen-file hashes remained unchanged.

## Browser checks actually executed

Validated in the Codex in-app browser through its supported computer-use interface:

- All four pivots retained the shared window; observed populations were 53 BSSID interfaces, 8 channels, 123 client aliases and 8 capture sources for this publication.
- Selecting a matrix cell exposed its matching count and source records; original frame S03-172 resolved with timestamp, source, original offset and capture SHA-256.
- Changing metric and selecting Last 5 min propagated to the export's scope and exact 300-second window.
- Opening a recurrence clue highlighted its affected rows and exact matching matrix cells while retaining other rows.
- The local JSON download completed. Engineer context was separately attributed; temporary test notes were cleared. No model call or external transmission occurred.
- Replay start removed later observations and export samples; End/Home seek restored/removed evidence. Opening a detail paused replay. A selected window beyond a backward replay cursor reset with an explicit notification.
- Mobile at 390×844 and desktop at 1440×1000 had no document overflow. Mobile modal fit, controls had accessible names, and matrix arrow-key navigation worked.
- Factory episode and capture-pattern entries reached the new screen. Original episode/pattern Action brief routes retained their established scope.
- Coverage examples outside the client projection resolved through the original frame service; beacon S01-5 was verified, avoiding an inappropriate client-projection lookup.
- Final browser error log contained no errors.

A new reusable Playwright suite is provided in `tests/clue-ui.test.mjs` and selected by `npm run test:ui`. **That standalone script was not executed in this session**; the browser checks above were performed directly through the supported in-app browser tools. Legacy UI suites remain as historical checks for the replaced screen's selectors.

## AI handoff

See `CLUE_SERVICE_API.md` for the schema and local retrieval interface. `test-results/clue-workspace/analysis-packet-example.json` is a clean AP-04 example generated directly from the service. Its compact serialization is 123,300 bytes; pretty-printed exports are larger. It includes structured aggregates, explicit sampling/omission information, immutable projection hashes, evidence references, measurement definitions, unknowns and analyst rules.

The JSON export does not give an external model automatic access to local files. Full drilldown requires supplying the documented files or a retrieval tool. No remote AI integration or live production feed has been added. General exploration and explicit clue rules do not guarantee detection of every anomaly, establish physical causes or verify application recovery.
