# Investigation workspace — product contract

## Objective and boundary

Redesign only the investigation screen so an engineer can characterize an unfamiliar problem before proposing its cause. With no AI, the engineer should be able to explain when behaviour changes, which entities share it, which peers differ, where observed progress stops, whether it resumes, and what evidence is missing.

The factory screen retains its established behaviour. Existing entry points, replay, frame provenance, source-quality inspection and client histories remain available. A **finding** is an inspectable observation that deserves attention, not a confirmed fault, physical diagnosis or exhaustive detector result.

The current capture is an acceptance fixture, not a list of all conditions the product recognizes. New metric values, entities and time distributions must drive the same views without hard-coded client IDs, six-case labels, reported totals or assumed physical locations.

## Information hierarchy

1. **Investigation context:** selected scope, recorded UTC interval, historical/replay mode, cutoff and evidence coverage. Opening an AP or incident establishes an initial focus; it must not hide relevant behaviour elsewhere.
2. **Time × entity matrix:** choose a supported measurement and pivot rows among available BSSID, channel, source or client dimensions. Colour denotes that named measurement. A cell exposes its exact interval, value, unit, sample size, denominator when applicable and member evidence. Count intensity is not an AP-health judgement.
3. **Aligned trends:** selection updates trends using the same interval and declared population. Actual clock time reveals shared windows; elapsed time from a declared transition reveals timer-like behaviour where matching observations support it. Unsupported alignments are unavailable, not approximated silently.
4. **Comparisons and progression:** show affected entities beside an explicit reference population or interval and summarize observed stages. “Association observed” and “protected traffic observed” do not establish security or application recovery.
5. **Explainable findings:** concise observations with visible supporting comparison and a route to exact evidence. The engineer can explore measurements even when no finding triggers.
6. **Evidence and handoff:** inspect underlying observations, restrictions and provenance; prepare a structured local snapshot for later AI analysis. Preparing or downloading this snapshot sends nothing externally.

The time and entity views also expose **type and frequency relationships**: dynamically derived protocol/event, termination-reason and response-status distributions within the current scope; AP-interface-to-observed-channel context; and a visual distribution or sequence of recurrence intervals when a repetition finding qualifies. A list of error labels or a single “periodic” sentence does not substitute for these comparisons. Histograms and bars retain denominators, exact member evidence and recorded-time caveats.

## General finding families

| Family | Question | Required caution |
|---|---|---|
| Change | What differs across comparable intervals? | Disclose reference window, sample size and unequal exposure. |
| Repetition | Does a transition or observation recur at similar intervals? | Publish rule, interval distribution, minimum sample requirement and timing restrictions; a regular cadence is not its cause. |
| Concentration | Is an aggregate dominated by one entity? | Show contributing entities and total denominator; high counts can follow high traffic. |
| Shared timing | Do several entities change in a common recorded window? | Unverified cross-source clocks preclude precise physical synchronization claims. |
| Group difference | Which peers behave differently? | Describe how peers are selected. A shared profile is not known unless published metadata supports it. |
| Stalled progression | Do repeated early-stage observations lack later-stage evidence? | Capture absence is not proof of failed completion. List which later stages are actually observable. |
| Unexpected absence | Did expected observations stop? | Requires an explicit expectation and source coverage; otherwise expose “no observations” rather than disappearance or outage. |

Every generated finding includes an identifier, family, observed interval, affected population, explicit rule/version, measurement, supporting member IDs, reference population if used, caveats and available next evidence. Missing families or weak evidence remain visible as capability limits. No confidence percentage should be invented.

## Measurement and interaction rules

- **Zero, absence and unavailable differ.** Zero is a computed count over an available admitted selection. No observed traffic does not mean the client is offline. Unknown source health, unsupported measurements, load errors and not-yet-released replay evidence are separately labelled. Unknown numeric values serialize as `null`, never as zero or an empty fabricated distribution.
- **Ratios are defined.** Name the counted observations and denominator. Show numerator, denominator, unit and minimum sample conditions. Retry-marked observations are not packet-loss percentage; successful responses are not uniquely matched successful transactions. Where the needed denominator is unavailable, show a count rather than an invented failure rate.
- **Comparisons are explicit.** State whether peers are other interfaces, clients on the same interface, other channels, a previous interval or another declared cohort. Never imply comparable workload merely because entities share a screen. Raw count and exposure information stay accessible.
- **Membership is not association.** An AP-interface aggregate can contain many client aliases because of addressed probe responses. Label these as aliases observed, not associated clients or load. A same-interface association cohort requires corresponding successful association observations; probe co-observation alone must not establish that cohort or prove the client received a response.
- **Selections remain linked.** Scope, window, pivot and metric consistently update matrix, trends, summaries, findings, evidence and export. Selecting a cell must not silently change replay time. Make clearing filters and returning to broader context obvious.
- **Context survives focus.** Show the same-window broader population or a clear outside-focus summary. A pattern spanning BSSIDs must remain discoverable from a single-BSSID entry.
- **Identity and topology are bounded.** BSSID aliases are observed interfaces, not a validated count or location of physical APs. Sensor-reported signal is not AP/client-heard link quality. No raw MAC addresses, EAP identities, credentials, packet bodies or restricted identity mappings enter the public workspace or export.
- **Replay is an evidence boundary.** All values, reference cohorts, findings, evidence members and exports obey cutoff plus release ordinal. Seeking backward removes later evidence. Late asynchronous results cannot replace a newer scope or generation. Final population counts must not leak into a partial replay view.
- **Accessibility is functional.** Matrix cells, finding selections and evidence navigation work without hover or colour alone; readable labels and tabular equivalents expose the same values. Dense views may scroll horizontally without hiding the active scope or controls.

## AI-ready evidence snapshot

The handoff is a versioned data contract, not an unstructured dump of screenshots or a diagnostic conclusion. It preserves the information needed to reproduce the visible result and assess its limits:

- Dataset identity and capture hashes; parser, projection, metric and finding-rule versions.
- Active replay context, generation and effective cutoff/release ordinal; requested versus available UTC interval.
- Focus, filters, pivot, bin boundaries, metric definition and units; reference cohort selection and explicit comparison scope.
- Computed cells/trends/stages with counts, denominators, sample sizes and explicit unavailable states; no future values or unstated normalization.
- Findings separated into observed facts and proposed interpretations, with predicates, thresholds, uncertainty and supporting evidence IDs.
- Inspectable minimized evidence with source, original frame number, timestamp, BSSID/client aliases and provenance; membership completeness and any evidence cap or pagination are declared.
- Coverage, source clock/health uncertainty, measurement restrictions, unsupported capabilities and data-loading errors.
- Unresolved questions and next evidence that could discriminate causes. Human-entered context, if supported later, is labelled separately from capture-derived facts.

The snapshot must be locally reviewable and serializable to valid JSON, with no automatic transmission or dependency on an AI provider. An AI consumer should be able to identify the same observations and limitations without inferring semantics from UI wording. If a compact export includes only evidence samples, it must disclose the sample rule and total membership, and preserve a way to resolve full membership; it must never claim the sample is the complete selection.

## Acceptance scenarios

| Scenario | Expected behaviour |
|---|---|
| Unseen temporal pattern | An unfamiliar distribution appears in the matrix and aligned measurements even when no detector emits a finding. No sample-specific identity or error code is required to explore it. |
| Normal heavy load | An interface with many observations is visibly distinguished by volume; it is not called faulty solely because its count is high. Any rate comparison includes exposure and sample size. |
| Shared event beyond the entry AP | Opening one interface still exposes same-window evidence outside it; the engineer can widen focus without losing the selected interval. |
| Type or channel-specific behaviour | Dynamically observed reason/status/type values are inspectable without hard-coded error categories; AP-interface/channel context permits comparing one channel across interfaces and one interface across observed channels. A known physical frequency interference source is not inferred. |
| Recurrent client dominates an AP | The contribution comparison identifies concentration and allows inspecting that client's sequence. Aggregate AP count alone does not become an AP diagnosis. |
| Source gap or missing measurement | Missing/loading/unsupported is distinguishable from a measured zero. No client-disappearance or source-offline conclusion follows without expected inventory and coverage. |
| Window or metric pivot | Every dependent view and export reflects the same new interval/measurement; stale evidence cannot remain as if it belonged to the new selection. |
| Cohort comparison | The interface shows the reference-selection rule and each population's size. Unknown device type, security profile or workload remains unknown. |
| Replay seek backward | Future findings, later stage observations, members and totals disappear consistently, including from downloads; equal-timestamp release boundaries remain respected. |
| Apparent reconnection | Joining or key observations are shown without asserting application recovery. A missing application capability is explicit. |
| Evidence handoff | The local JSON includes provenance, scope, definitions, uncertainty and reproducible member references. It contains no raw identity, no secret and no external-send side effect. |
| Keyboard and narrow viewport | Controls and cell details remain reachable and legible; focus is restored after updating linked views; colour is not the only value encoding. |

## Completion standard

Ship when the redesigned investigation route, its evidence service and local handoff satisfy the applicable scenarios; factory/action behaviour remains intact; tests cover scope/replay/privacy/calculation semantics; and UI limitations are reported accurately. Do not claim full capture observability, physical root-cause diagnosis, verified recovery, a real-time production transport or every possible anomaly merely because the current fixture is covered.
