# M08 — Action brief, validation and export

Reference: [approved action brief](../design-concepts/03-action-brief.png). The module supports an engineer’s next decision; it never changes network infrastructure.

## Screen structure

Preserve the left-context/right-action layout: approximately 35% event list and selected frame detail, 65% brief. The brief contains observed summary, large cause state, evidence and hypothesis grades, trust limitations, ordered next checks, validation plan and export. “Human review required” remains prominent. A persistent note says “Monitoring does not change infrastructure.”

The left event list is real M04 episode membership, not the fabricated screenshot rows. AF-104 association is S03-6135. Selected frame detail uses the same component and provenance as M07. Opening from a selected frame preserves it; opening without a frame defaults to the opening anchor. Closing restores the prior selection and focus.

## Brief content contract

Freeze an incident revision when creating a brief. Include observed statement, unresolved questions, grades and reasons, supporting selections, recommended evidence collection, proposed operator action if any, risks, preconditions, rollback requirement and validation criteria. New evidence can create a revised brief only through explicit refresh, with differences identified.

AF-104 default next checks:

1. Inspect relevant AP/controller records around the recorded opening time, accounting for unknown clock alignment. Determine the actual decision context rather than assuming reason code 23 identifies a physical cause.
2. Compare channel observations and capture coverage. Distinguish AP-transmitted response retries from client movement or client signal degradation.
3. If a qualified operator proposes a change, record scope, approval, maintenance window, rollback and comparison criteria before observing results.

Do not prescribe AP relocation, channel/power changes, dead-zone isolation, or authentication-policy edits as a proven remedy. No controller integration or automatic command execution is included.

## Plan fields and lifecycle

Required plan fields: incident revision, origin, objective, operator-entered change/no-change note, affected logical identities, baseline window, comparison window or forward duration, eligible exposure definition, success criteria, abort criteria, and limitations. Optional owner text is user-entered and must not be inferred from captures. Timestamp plan creation separately from packet time.

Statuses are draft, running, insufficient_evidence, completed, stopped. Conclusions are criteria_met, criteria_not_met, or inconclusive; these do not assert causality. Starting requires a valid window, measurable criteria and future exposure relative to the selected baseline. If unavailable, return validation_requires_future_exposure and explain the missing requirement. Stopping retains partial results and cannot become completed automatically.

## Three distinct origins

| Origin | Available now? | Meaning and constraints |
|---|---|---|
| Offline comparison | Yes, within supplied capture coverage | Compares recorded windows; does not validate a newly executed physical fix |
| Live observation | No, until M09 | Requires actual connected feed, coverage/trust reporting and post-change observations |
| Simulated demonstration | Optional test/demo only | Permanently labeled simulated; cannot mix synthetic recovery with observed evidence |

The current primary control should say “Start offline comparison” when sufficient recorded exposure exists. Otherwise offer “Save validation plan.” Do not display an active live-monitoring promise. Never manufacture a successful before/after result from the same incident endpoint.

## Comparison semantics

Record exact selection predicates, time basis, durations, source/client coverage and rule versions for both windows. Equal duration alone does not establish comparable production conditions. Count observed disconnects and measurable protocol intervals only for eligible episodes; report denominator and censored/incomplete episodes. An absent disconnect with no client activity is insufficient evidence, not success.

Criteria thresholds are explicitly user/configuration-defined, never invented service SLAs. A no-repeat criterion must define observation duration and minimum relevant exposure. Missing coverage, uncertain cross-source alignment or too few eligible episodes yields inconclusive. A positive result means only that defined criteria were met in available observations; it does not prove a change caused improvement or restored application service.

## Persistence and export

Persist plans/annotations locally with schema version, dataset identity and revision references. Show saved/unsaved state. Storage denial or quota failure must not lose the visible draft; offer export and retry. Dataset replacement or version mismatch leaves old records readable but explicitly incompatible for new execution. Destructive draft deletion requires a clear confirmation and affects only that record.

Export a human-readable brief and machine-readable manifest as one downloadable package or paired files. Include mode, cutoff, revision, origin, all versions, observed summary, exact selected frame references, selection predicates and counts, limitations, proposed checks and validation state. Pseudonymize standard output; exclude raw captures, address registry and application payload. Filename contains incident alias and revision, not raw identifiers. A failed export shows an actionable error without claiming a file was saved.

## Acceptance

Verify no network action occurs; frozen brief consistency; offline/live/simulation labels survive export; insufficient exposure cannot pass; nulls cannot become success; local storage failure is recoverable; selected-frame continuity; no future evidence in replay exports; all exported claims resolve to their recorded snapshot. Deliver lifecycle fixtures, comparison definitions, export samples, privacy audit and reference-size screenshots.
