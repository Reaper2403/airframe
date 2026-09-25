# AIRFRAME

An evidence-grounded factory-network investigation prototype, built around the approved Factory → Investigate → Action brief workflow.

## Use locally

From this directory, run `npm start`, then open http://127.0.0.1:4173. Node.js 24 is required. The dashboard uses native browser modules. Keep the server running while using the local app. Optional incident report generation calls OpenAI from this local server and requires Python with ReportLab for its one-page PDF.

Start with AF-104 or select **Capture patterns** in Factory. The redesigned investigation screen opens a shared time window across the capture. Pivot the matrix between AP interfaces, channels, clients and sensors; select a measurement; focus an entity without hiding its peers; and inspect the observations behind a cell or clue. Connection stages and comparisons describe observed behaviour without asserting a physical cause.

**Prepare incident report** previews the active evidence scope. Keep or download the local JSON, or choose **Generate incident report** to send verified pseudonymized evidence and separately attributed notes to OpenAI. The result prioritizes at most three cross-view deductions with evidence, rationale and next checks, then downloads as a one-page PDF. Configure a server-only credential file as described in [the report integration guide](docs/INCIDENT_REPORT_API.md). **Original action brief** retains the existing incident's evidence request and validation plan; it does not inherit a newly selected comparison window. Factory and Action brief have not been redesigned. Plans still save on the current browser/device. No network configuration is changed.

## Verification

Run `npm test` for service/parser/static checks. With the preview running, run `npm run test:ui` for the full browser suite. Browser tests require Playwright and Chrome; the suite uses an installed Playwright package or the configured Codex runtime fallback. Set AIRFRAME_TEST_URL or AIRFRAME_BROWSER_CHANNEL to override the local URL or browser channel. This is a test dependency only, not part of the delivered app.

The redesigned-screen UI suite writes its report and desktop/mobile screenshots into local `test-results/clue-workspace/`. Earlier browser suites remain under `test:ui:legacy` as historical pre-redesign checks; their investigation selectors target the replaced screen. See the verification records in `docs/` for executed checks and limitations.

## Data and boundaries

Eight original captures contain 1,118,853 records. The local indexed normalized store covers the complete capture set. The original 562-observation bundle retains three curated episode windows. Expanded diagnostic metadata is published separately in `dist/data-v3`, with scoped client histories, capture patterns and lazy quality/evidence partitions. It is an allowlisted diagnostic projection, not unrestricted packet access. Selection definitions distinguish observations, clients and recurring-event groups.

The investigation comparison service uses an integrity-checked compact projection in `dist/data-v4`, derived from the published client histories. It is not a replacement for the full raw capture store. Empty bins, unavailable measurements and unknown source health are explicitly distinguished; an observation count is not an AP fault rate. Replay restricts the workspace and its exported snapshot to evidence admitted at the selected recorded time.

`scripts/build_evidence.py` regenerates the local store and curated browser bundle from `data/raw/sensor01.pcap` through `sensor08.pcap`. `scripts/build_diagnostics.py` publishes the expanded diagnostic metadata using those captures and the existing identity registry. This requires the supplied captures, Python and Node. The scripts verify input hashes; never replace inputs with invented data to make an audit pass. Raw captures, local databases and restricted identity mappings are excluded from source publication and site packaging. Only sanitized derived artifacts in `dist` are served.

Factory geometry and placements are illustrative. Reason 23 reports an IEEE 802.1X failure class, not a particular RADIUS, certificate or account-lockout cause. Open-system authentication, association, enterprise security and application recovery are separate boundaries. Capture timestamp/PHY anomalies constrain physical timing and RF conclusions. Missing packets do not prove failed exchanges. No live controller/AAA feed, infrastructure-control integration or measured physical location is provided. The contextual guide uses bounded evidence templates rather than an external language model.

## Project map

- [Contract and module specifications](contract.md)
- [Implementation interface](docs/implementation-interface.md)
- [Build decisions](docs/BUILD_DECISIONS.md)
- [Diagnostic remediation plan](docs/DIAGNOSTIC_REMEDIATION_PLAN.md)
- [Remediation verification](docs/REMEDIATION_VERIFICATION.md)
- [Clue workspace product contract](docs/CLUE_WORKSPACE_PRODUCT.md)
- [Clue service and AI handoff API](docs/CLUE_SERVICE_API.md)
- [Redesign verification](docs/CLUE_WORKSPACE_VERIFICATION.md)
- `dist/js/service.js`: projection boundary and detector evaluator
- `dist/js/diagnostic-service.js`: expanded scoped history, patterns, quality and security projections
- `dist/js/app.js`: one replay clock, navigation, integrity gate and frame dialog
- `dist/js/factory.js`: illustrative spatial working surface
- `dist/js/clue-workspace.js`: linked visual comparisons, evidence inspection and local AI handoff
- `dist/js/clue-service.js`: generic measurements, clue predicates and versioned analysis snapshots
- `dist/js/investigation.js`: retained legacy investigation helpers
- `dist/js/action.js`: frozen brief, local plan and export
- `dist/js/diagnostics.js`: expanded diagnostic controls and scope-aware views
- `tests/`: data, parser, privacy and interactive-browser regression tests
