# M02 — Deterministic replay and protocol state

Authority: [contract](../contract.md). Dependencies: M01 observations and capability report. Owner: replay/state agent. Expose a clock and episode service, not UI timers with independent business logic.

## Two explicit operating modes

Historical review opens a completed incident and may inspect its whole selection. Capture replay reconstructs observations incrementally. A mode switch is visible, clears incompatible pending queries, increments analysis generation, and rebinds all screen projections.

The landing demo can begin in historical review with AF-104 selected. “Replay this investigation” seeks to a defined pre-roll and rebuilds state from the same dataset/configuration. Never show a completed historical card as if a live detector just discovered its future endpoint.

## Clock contract

Clock states: ready, playing, paused, seeking, ended, and error. A shared session exposes event cursor, release ordinal, playback speed, and generation. Wall time determines pacing only. Windows, thresholds, recovery duration, and state transitions use event time.

Merge source streams by recorded timestamp, source ordinal, and original frame number. This is deterministic recorded-time ordering; cross-source physical order remains unverified. Do not adjust source clocks from their capture-start differences. Same-source duration is usable as recorded elapsed time; quantified oscillator error remains unknown.

At speed 20×, every relevant event must still reach the engine. Rendering may coalesce updates, but state processing cannot skip events. Pause stops event release. Large wall-clock scheduling delays must not drop records. At capture end, stop advancement and mark unresolved episodes as observation_window_ended rather than healthy.

Seek rebuilds from a compatible checkpoint at or before the cursor and processes only the necessary prefix. A checkpoint records dataset, schema, parser, alias, detector-config versions, release ordinal, and complete module state. Changed configuration invalidates checkpoints. Backward seek discards later revisions from the active projection while preserving an independently saved historical snapshot if the user explicitly pinned it.

## Temporal visibility

Every read operation receives active cursor plus release ordinal. Operations reject future frame IDs even when those IDs are known from a previous historical view. Search, card counts, charts, assistant answers, tooltips, exports, and accessibility text obey the same cutoff. A progress axis may show the selected replay range but must not leak a success outcome through labels before release.

For AF-104, replay at 12:25:28.328446 can show the deauthentication. It cannot show 13.127 s, 46 total responses, or successful association. At 12:25:41.454175 it may show captured authentication success. Only after 12:25:41.455330 can it show the association response and final same-source interval.

## Episode transition model

| Input | Current-context behavior | What it does not establish |
|---|---|---|
| Deauthentication/disassociation | Open or append a disconnect episode, preserving transmitter role and reason | Automatic failure, backend cause, or actual user downtime |
| Client probe request | Append probe activity and channel/source context | Physical movement or successful roam |
| AP probe response addressed to client | Append addressed response context and retry flag | Client heard response, client RSSI, or duplicate frame |
| Authentication success response | Mark auth_success_observed, preserve algorithm/transaction | Completed EAP or key exchange |
| Association success response | Mark association_success_observed and recorded elapsed interval | Working application or restored production |
| Explicit nonzero status | Append rejection evidence with verified field interpretation | Reason beyond the visible protocol report |
| Lack of progress | Advance an observation timer with visibility caveat | Definitive timeout when trust/coverage unknown |
| Capture boundary | Mark observation_window_ended | Recovery or continued outage |

Use client identity as the central episode key, with separate BSSID/channel contexts. Partitioning entirely by BSSID would lose transitions. Broadcast probes join active client context, not a fictional broadcast AP. Repeated disconnects append recurrence within a configurable episode gap; simultaneous contexts and independent clients must remain distinguishable.

Define an initial reconnect context horizon of 20 event seconds after a disconnect for the curated demonstration, matching the legacy discovery window without looking ahead. It is a demo parameter, not an industry standard. If association arrives after expiry, start a linked late observation or revise the historical episode without retrospectively claiming an earlier successful recovery. M03 owns the exact signal rules within this context.

## Corrections and late data

Offline replay defaults to deterministic event-time release. A separate synthetic arrival-order test mode can inject delay to test M09. It must be labeled and must not imply real ingestion timings exist in the captures.

Incident revisions retain original detected_at and append corrected_at. Late evidence can change membership or completeness, but never erase the original decision record. Triage snapshots stay fixed until the user chooses “Review newer evidence.”

## UI integration

M05 supplies one shared replay control used on the overview and workspace. M07 binds the timeline and currently visible events to the shared cursor. Frame selection and replay cursor are separate states. Playing should not force an open frame drawer to jump to a different event. Leaving a route does not create a second playback timer.

Keyboard operation: play/pause via focused button, arrow-step by event, range slider with meaningful UTC value and elapsed-time description. Reduced-motion mode changes animation only, not processing.

## Acceptance

- At 1×/5×/20×, final semantic episode/incident output is identical for the same input/configuration.
- Pause and resume create no duplicate observations or transitions.
- Seek backward before the association removes the completed duration and endpoint everywhere, including assistant and export.
- Equal timestamps produce a stable order without implying a verified physical ordering.
- Replay a prefix alone and compare it with the same prefix of a complete run: domain output must match.
- A 20-second observation window ending without recovery yields “No association response observed in this window,” qualified by source trust.
- Simulated late delivery creates a new revision with a visible correction notice; pinned evidence remains unchanged.

Handoff: state transition table, canonical ordering policy, clock commands/results, checkpoint compatibility rules, prefix-test report, and known timing limitations.
