# M07 — Incident workspace

Reference: [approved workspace](../design-concepts/02-incident-workspace.png). Dependencies: M02 session controls, M04 evidence boundary, M05 shared components.

## Layout and hierarchy

Use a full-width identity/header band with breadcrumb, title, client/AP context, time and evidence/cause grades. Below, allocate approximately 62% to sequence/timeline/table and 38% to interpretation/unknowns/citations/questions/action. Keep selected evidence and its meaning simultaneously visible on desktop. On narrow screens order: identity, established facts, protocol sequence, timeline, evidence, unknowns, questions, action.

The three leading metrics are recorded deauth-to-association elapsed time, retry-marked probe-response observations, and response viewpoints. Each includes selection/citation access. They are unavailable or provisional before the necessary observations are released. Do not use the rounded duration as the replay clock’s precise endpoint.

## Protocol progression

Cards represent observed deauthentication, probe context, authentication response, and association response. They are navigation targets to the corresponding evidence selections. An unobserved phase is explicitly “Not observed in available captures,” not failed. Probe context spanning sources uses a separate correlated styling from same-source anchor sequence.

For AF-104, the three anchor frames are S03-5099, S03-6132 and S03-6135, channel 44. Show reason 23 and status 0 as header facts. Successful open-system authentication is not an EAP success. Use “Association observed” rather than “Connection restored.” Keep evidence partial and cause unresolved.

## Eight-lane event timeline

One lane per source with source ID and manifest channel. Horizontal position uses recorded event time relative to selected incident opening; this is not clock-corrected alignment. Persist the unverified-alignment notice near the chart. Use distinct observed-anchor, related-context and unavailable/not-observed styles with text legend. Do not draw invented ticks to imitate the image.

At dense zoom, aggregate into count-preserving bins. A bin opens its exact evidence selection and displays count and interval. At sparse zoom show individual marks. Marks sharing a timestamp remain independently reachable through a list/popover. The selected mark highlights its table row and detail panel, but does not automatically move playback time. A separate “Seek to frame” action uses M02.

The accessible equivalent lists events with source, timestamp, event and citation. No hover-only details. Empty lanes remain visible as source context, but absence of matching events is not source failure.

## Replay controls

Historical review displays the completed sequence. Entering replay explicitly changes mode and starts from a selected pre-incident context point, not silently at the final result. Controls: play/pause, scrubber with accessible time input, 1×/5×/20× speed, restart, and current/total recorded range. Playback position and selected evidence are separate state.

Scrubbing invokes generation-changing seek and shows a seeking state. During recomputation, suppress questions/export/validation mutations bound to the old context. Arrow-key stepping should use a documented time increment; provide previous/next observed event navigation independently. At capture end say “End of available capture,” not resolved. Speed affects pacing only, never which observations are processed.

## Evidence table and details

Default columns: frame reference, recorded UTC, event subtype with code, source, channel, and signal. Source RSSI is an observation at that sensor; label the transmitter role in details. Null signal is “Unavailable” with its missing reason, not zero or an interpolated line.

Tabs/filters separate anchors, retry responses, client probes, and all episode context. Show “Showing A–B of N matching observations” with selection name. Pagination and filters preserve the snapshot contract. Clicking a row opens normalized header detail with original frame ordinal, capture hash reference, exact microsecond time, address aliases and roles, flags, sequence, status/reason, parser limits and selection membership. Raw MAC access is outside the standard UI.

## Interpretation rail

Sections follow the image: “What the evidence establishes,” “What remains unknown,” “Related evidence,” “Ask about this sequence,” and “Open action brief.” Facts and unknowns come from M04 claim objects. Each related item opens its cited frame or aggregate, never a generic evidence page. Unsupported questions return a bounded explanation and suggested supported questions. No fabricated assistant streaming is necessary.

If a question is running when context changes, cancel/discard it. An answer must visibly identify its incident revision and retain its citations. Suggested prompts include “What does 13.127 s measure?” and “What evidence would explain the AP decision?” Avoid suggesting questions the dataset cannot answer as if they were supported predictions.

## Acceptance

AF-104 duration and all anchors match the ledger; final 46 response observations and 10 client probes are separately inspectable; channels match all eight manifests; every mark and statement resolves to a selection; replay before association exposes neither successful endpoint nor final duration through text, accessibility labels, questions or exports. Verify cross-filter navigation, stale answer cancellation, dense bins, missing fields, empty lanes and narrow layouts. Handoff includes screen-state screenshots and a trace from each visible metric to M04 selection identity.
