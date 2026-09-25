# AIRFRAME

An evidence-grounded factory-network investigation prototype, built around the approved Factory → Investigate → Action brief workflow.

## Use locally

From this directory, run `npm start`, then open http://127.0.0.1:4173. Node.js is required. The app uses native browser modules and has no installation step or third-party runtime requests. Keep the server running while using the local app.

Start with AF-104 or select **Capture patterns** in Factory. Investigation offers Episode, Client history and Capture pattern scopes, with frame provenance, security-stage observations and capture-validity limitations. Use the Action brief to prepare a scoped evidence request and validation plan. Plans save on the current browser/device; exports create a downloadable evidence brief. No request is sent and no network configuration is changed.

## Verification

Run `npm test` for service/parser/static checks. With the preview running, run `npm run test:ui` for the full browser suite. Browser tests require Playwright and Chrome; the suite uses an installed Playwright package or the configured Codex runtime fallback. Set AIRFRAME_TEST_URL or AIRFRAME_BROWSER_CHANNEL to override the local URL or browser channel. This is a test dependency only, not part of the delivered app.

The UI suite writes its report, component inventory and desktop/mobile screenshots into local `test-results/`. See [remediation verification](docs/REMEDIATION_VERIFICATION.md) for current scope, results and limitations; the earlier release record is retained separately.

## Data and boundaries

Eight original captures contain 1,118,853 records. The local indexed normalized store covers the complete capture set. The original 562-observation bundle retains three curated episode windows. Expanded diagnostic metadata is published separately in `dist/data-v3`, with scoped client histories, capture patterns and lazy quality/evidence partitions. It is an allowlisted diagnostic projection, not unrestricted packet access. Selection definitions distinguish observations, clients and recurring-event groups.

`scripts/build_evidence.py` regenerates the local store and curated browser bundle from `data/raw/sensor01.pcap` through `sensor08.pcap`. `scripts/build_diagnostics.py` publishes the expanded diagnostic metadata using those captures and the existing identity registry. This requires the supplied captures, Python and Node. The scripts verify input hashes; never replace inputs with invented data to make an audit pass. Raw captures, local databases and restricted identity mappings are excluded from source publication and site packaging. Only sanitized derived artifacts in `dist` are served.

Factory geometry and placements are illustrative. Reason 23 reports an IEEE 802.1X failure class, not a particular RADIUS, certificate or account-lockout cause. Open-system authentication, association, enterprise security and application recovery are separate boundaries. Capture timestamp/PHY anomalies constrain physical timing and RF conclusions. Missing packets do not prove failed exchanges. No live controller/AAA feed, infrastructure-control integration or measured physical location is provided. The contextual guide uses bounded evidence templates rather than an external language model.

## Project map

- [Contract and module specifications](contract.md)
- [Implementation interface](docs/implementation-interface.md)
- [Build decisions](docs/BUILD_DECISIONS.md)
- [Diagnostic remediation plan](docs/DIAGNOSTIC_REMEDIATION_PLAN.md)
- [Remediation verification](docs/REMEDIATION_VERIFICATION.md)
- `dist/js/service.js`: projection boundary and detector evaluator
- `dist/js/diagnostic-service.js`: expanded scoped history, patterns, quality and security projections
- `dist/js/app.js`: one replay clock, navigation, integrity gate and frame dialog
- `dist/js/factory.js`: illustrative spatial working surface
- `dist/js/investigation.js`: sequence, timeline, paged evidence and questions
- `dist/js/action.js`: frozen brief, local plan and export
- `dist/js/diagnostics.js`: expanded diagnostic controls and scope-aware views
- `tests/`: data, parser, privacy and interactive-browser regression tests
