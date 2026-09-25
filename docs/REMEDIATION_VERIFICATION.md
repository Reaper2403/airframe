# Diagnostic remediation verification

Status: local integration verification passed on 25 September 2026. Production integrations and a newly performed factory repair are not claimed.

## Baseline

Before remediation changes, the existing service and static suites ran successfully: 19 tests passed, zero failed. The existing 31-scenario UI suite then ran against http://127.0.0.1:4173: all 31 passed, with no runtime exceptions. The baseline result is preserved in test-results/remediation/baseline-ui-report.json. These 50 baseline checks are not acceptance of the new information architecture.

## Required component coverage

| Area | Meaningful behavior to verify |
|---|---|
| Factory | Episode and pattern tabs, all episode selection, computed pattern membership, search/filter/clear, map pan/zoom/reset, all AP contexts, mobile map toggle, coverage entry, two-selection navigation |
| Scope | Episode, earlier/later context, client history, recurrence member, capture pattern and member-client return breadcrumb; filters and cutoff preserved |
| Stages | Open-system authentication distinct from EAP; EAP/key/protected/service states, absent M2 versus later M3, stage evidence filtering, unsupported/unavailable/not-yet distinction |
| Evidence | Source/event/transmitter filters, empty result, pagination complete without duplicates, selection predicate, frame provenance, previous/next, drawer close and focus return |
| Quality | Clock versus within-source timing, PHY and container findings, source/frame references, metric-specific veto, parsed versus measurement-valid distinction |
| Interpretation | Failure meaning, competing explanations, next discriminating evidence, unsupported question specificity, citations, question/context freshness |
| Replay | Start/pause/speeds/restart/seek/previous/next; stable focus; cutoff/ordinal admission on every new projection and export |
| Action | Bounded anchor rail, all observations, scoped draft request, separate association/security/service/recurrence outcomes, incomplete checks remain inconclusive |
| Persistence/export | Every plan field, native validity, local save/reload, blocked storage retains draft, sanitized export, snapshot refresh, backward seek removes future evidence |
| Async reliability | Delayed/out-of-order responses, changed scope/filter/cutoff, failed chunk and retry, integrity mismatch, missing versus empty data |
| Privacy | Public artifact scan, EAP identity fixture minimization, MAC/SSID exclusion, evidence export and answer-context minimization |
| Accessibility/layout | Keyboard tabs/buttons/drawers, named controls, focus preservation, reduced motion, 200% text zoom, 1280×720, 1024×768, 768 px and 390 px layouts |

## Evidence and execution record

The frozen integrated service/static/parser run passes 39 checks. The adapted legacy UI suite passes all 31 scenarios. The expanded remediation UI suite passes all 26 scenarios. Total: 96 checks/scenarios passed, zero failed. Both UI runs report zero runtime exceptions. The new suite monitors exceptions in its additional failure-injection pages as well as its primary page.

### New executable suites

- tests/remediation-service.test.mjs: exact cohorts, global deduplication, full client coverage, scoped history pagination, security-stage isolation, reason semantics, transmitter retry predicates, quality membership, missing and stale asynchronous data, byte integrity, actual key-message matches and replay admission.
- tests/remediation-parser.test.mjs: synthetic EAP identity minimization, protection, truncation and malformed request/response length.
- tests/remediation-static.test.mjs: every public JSON artifact, prohibited fields and identity-like values, advertised integrity partitions and bounded artifact size.
- tests/remediation-ui.test.mjs: new and changed controls, diagnostic semantics, loading/error/retry, scope isolation, export/persistence, replay, responsive screenshots and keyboard focus.

The existing service and UI tests remain in the combined package commands. Legacy selectors were adapted to intentional replacements: metric shortcuts now live in evidence tabs; protocol-anchor inspection remains available through cited evidence; URLs now preserve diagnostic scope. Underlying provenance, membership and replay assertions were not removed.

### Verified data reconciliation

- 506 reason-23 termination observations, 63 globally deduplicated clients, eight sources.
- 1,477 reason-2 termination observations, 18 clients meeting the recurrence rule.
- 123 published non-AP unicast address histories, including 28 aliases outside the original C-prefixed role group. Multicast addresses are excluded from the client registry.
- Five explicitly matched four-key-message sequences across four clients. Matching does not verify MICs, EAP success or application service.
- The AF-104 opening-to-association retry selection remains 46 observations. Wider client/context windows legitimately have different counts; tests preserve the exact predicate.

### Defects found and verified repaired

- Malformed EAP request/response without its mandatory type was accepted as parsed.
- Security progression could adopt another client’s observations or a non-open authentication algorithm.
- The initial quality artifact was an oversized monolithic file; quality membership is now lazily paginated.
- Initial client publication omitted non-C aliases, then temporarily included multicast aliases; the final unicast predicate is verified.
- Pattern/member UI retained original-episode context in headers/actions; selected client and pattern now remain bound through request/export.
- Scoped validation-plan reload lost the selected scope; URL restoration now passes.
- Mobile Episode Investigation exceeded the viewport; the repaired layout passes the retained phone regression.

### Final navigation regression

Quality membership to frame to Back initially restored a visual snapshot without rebinding its All findings and pagination handlers. The owner changed the return action to reconstruct the same membership page with working controls. The final full remediation UI run verifies page navigation, frame opening, return to that page and return to all findings.

No unresolved blocking issue remains in the executed component matrix. Tests are evidence of the exercised behaviors, not a claim that arbitrary untested interactions or production integrations are defect-free.

### Artifacts

- test-results/remediation/baseline-ui-report.json preserves the original baseline.
- test-results/ui-report.json contains the latest retained-flow results and control inventory.
- test-results/remediation/ui-report.json contains expanded-flow results.
- test-results/remediation/unit.tap contains the final 39-test machine-readable service/parser/static run.
- test-results/remediation/factory1280.png, investigation1280.png, history1280.png, pattern1280.png, action1280.png and action-mobile.png identify actual reviewed scopes.
- Additional screenshots cover 1024×768, 768×1024 and 390×844 layouts.

Visual inspection confirms the blueprint/dark industrial identity is retained and diagnostic priority is readable without requiring the raw capture. The local in-app-browser session was unavailable when visual QA resumed; actual browser screenshots generated by the functional test run were inspected instead. Explicitly verified viewport sizes are 1280×720, 1024×768, 768×1024 and 390×844, plus the retained 1600×1000 and 800×600 checks. Keyboard focus, accessible names and reduced motion are exercised. A native 200 percent browser text-zoom audit was not separately performed and is not included in the pass claim. These tests cover the static recorded-data demo, not production network integration, live source health or an actual factory repair.

## Reproduction

Run the local preview, then use the package commands npm test and npm run test:ui. The first invokes all five service/parser/static files; the second invokes both retained-flow and remediation UI suites. Python parser fixtures use AIRFRAME_PYTHON when set, otherwise python3. Browser tests require Playwright and Chrome; their existing runtime fallback is retained for this workspace. Local storage and downloads are created only inside isolated test-browser contexts; each test run starts with fresh contexts rather than changing the user's browser state.
