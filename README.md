# AIRFRAME

An evidence-grounded factory-network investigation prototype, built around the approved Factory → Investigate → Action brief workflow.

## Use locally

From this directory, run `npm start`, then open http://127.0.0.1:4173. Node.js is required. The app uses native browser modules and has no installation step or third-party runtime requests. Keep the server running while using the local app.

Start with AF-104. Inspect its packet anchors, switch between complete evidence selections, replay the sequence, and open an action brief. Plans save on the current browser/device; exports create a downloadable text brief containing a machine-readable snapshot.

## Verification

Run `npm test` for service/parser/static checks. With the preview running, run `npm run test:ui` for the full browser suite. Browser tests require Playwright and Chrome; the suite uses an installed Playwright package or the configured Codex runtime fallback. Set AIRFRAME_TEST_URL or AIRFRAME_BROWSER_CHANNEL to override the local URL or browser channel. This is a test dependency only, not part of the delivered app.

The UI suite writes its report, component inventory and desktop/mobile screenshots into local `test-results/`. See [release verification](docs/RELEASE_VERIFICATION.md) for scope, results and limitations.

## Data and boundaries

Eight original captures contain 1,118,853 records. The local indexed normalized store covers the complete capture set. The browser receives 562 pseudonymized observations covering three complete curated client-episode windows, plus manifest metadata; it is not a general browser for every capture record. The initial bundle is 525,649 bytes.

`scripts/build_evidence.py` regenerates the local store and verified browser bundle from `data/raw/sensor01.pcap` through `sensor08.pcap`. This requires the supplied captures, Python and Node. The script verifies expected hashes; never replace inputs with invented data to make the audit pass. Generated local data and the restricted address mapping are excluded from source publication and site packaging.

Factory geometry and placements are illustrative. Recorded association success does not prove application recovery. No live feed, infrastructure-control integration or measured physical location is provided. The contextual guide uses bounded evidence templates rather than an external language model. These limitations are deliberate and visible in the app.

## Project map

- [Contract and module specifications](contract.md)
- [Implementation interface](docs/implementation-interface.md)
- [Build decisions](docs/BUILD_DECISIONS.md)
- `dist/js/service.js`: projection boundary and detector evaluator
- `dist/js/app.js`: one replay clock, navigation, integrity gate and frame dialog
- `dist/js/factory.js`: illustrative spatial working surface
- `dist/js/investigation.js`: sequence, timeline, paged evidence and questions
- `dist/js/action.js`: frozen brief, local plan and export
- `tests/`: data, parser, privacy and interactive-browser regression tests
