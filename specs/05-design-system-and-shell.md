# M05 — Design system and shell

Authority: [master contract](../contract.md). Visual target: the three approved images, with corrections from [the ledger](00-data-grounding.md).

## Ownership and design intent

Own shared tokens, typography, controls, navigation, route/selection coordination, accessibility, and global mode/trust labels. Screen agents compose these primitives; they must not introduce competing buttons, colors, stores, or modal systems. Calm industrial precision takes precedence over decorative density.

## Tokens and layout

| Property | Initial specification |
|---|---|
| Canvas / elevated surface | Near-black #0A0A0A / #121212; subtle separation, no gratuitous gradients |
| Primary / secondary text | #F5F5F7 / #AEB8C3; verify actual rendered contrast |
| Evidence / attention / association | Icy blue #8FCBFF / amber #FFBE45 / green #86D97B; always paired with text or shape |
| Spacing | 4 px base; 8, 12, 16, 24, 32 px steps |
| Corners / borders | 6–8 px control/panel radius; restrained one-pixel silver-gray edges |
| Type | Local/system sans-serif; monospace for times, source IDs and technical values; tabular numerals |
| Scale | 32 px page title, 22 px panel title, 16 px main body, 14 px secondary; essential labels never below 12 px |
| Interaction | At least 44 px primary control targets; clearly visible focus outline; hover never the only affordance |
| Motion | 120–180 ms opacity/selection transitions; no continuously pulsing warnings; honor reduced motion |

Exact colors may be adjusted to pass contrast testing without changing semantic roles. Amber means attention/selection, not a quantified production severity. Green means an observed association endpoint only where labeled. Gray means unavailable/unselected, not a failed sensor.

Desktop reference is approximately 1600 × 1000. At widths at least 1280 px use the approved split layouts. From 900–1279 px permit narrower rails and wrapped summaries. Below 900 px stack content in task order; map is collapsible, never the only route to an incident. At 200% zoom, essential actions and messages remain reachable without clipped fixed-height panels. Large evidence tables may scroll horizontally inside their own named region.

## Shared components

Provide application header, mode badge, trust notice, incident card, labeled metric, status chip, primary/secondary button, source badge, timestamp, evidence citation, empty/error/loading panel, paginated table, filter control, timeline legend, frame detail panel, confirmation dialog and toast/status region. Each supports keyboard focus, disabled explanation, loading behavior, and test identifiers without embedding domain calculation.

Metric inputs contain value, unit, semantic label, precision policy, evidence reference, and unavailable reason. No component substitutes zero for null. Tooltips supplement readable content; they do not contain the only explanation of a limitation.

## Navigation and shared state

Routes represent Factory, investigation identity, and action brief for that identity. Route/query state preserves selected frame, evidence filter, and mode where appropriate. Reload/deep-link handling resolves against the active dataset; unknown incident IDs show a recoverable not-found state. Navigation back restores filters, map viewport, and scroll position. Switching dataset clears incompatible selections after warning about unsaved plans.

The header shows AIRFRAME, Factory, Investigate, and an explicit “Historical review” or “Capture replay” mode control. Do not label recorded data “Live.” Mode changes go through M02 and invalidate stale requests. The date is derived from selected capture context, with UTC explicitly visible, not the machine’s current date.

Factory → selected investigation → action brief requires two primary selections. The overview may preselect AF-104 in a curated demo, but this must not imply an online detector found it before its opening frame. Closing a brief returns focus to its launching control; a direct deep link returns to its investigation.

## Required global states

- Opening: neutral skeletons and “Loading capture evidence”; no fabricated metrics.
- Missing dataset: explanatory screen and retry/select-dataset action.
- Partial parsing: persistent non-blocking limitation plus access to rejected-record summary.
- Seeking: retain a visually subdued snapshot, identify recomputation, disable evidence mutations until new generation arrives.
- Empty prefix: “No investigations observed at this replay time.”
- Storage unavailable: readable evidence continues; unsaved plans clearly marked, export offered.
- Fatal projection error: retry or return to Factory; never strand navigation.

## Accessibility and handoff

Use semantic headings, table headers, named controls, textual chart alternatives, visible focus, and logical tab order. Color never carries sole meaning. Announce meaningful state changes politely, not each packet or timer tick. Preserve focused rows during refresh or provide an explicit refresh control. Keyboard shortcuts, if added, must be discoverable and must not override typing in inputs.

Acceptance includes keyboard-only traversal of the entire two-selection journey, contrast checks, reduced motion, screen-reader naming, 200% zoom, narrow layout and long-label stress fixtures. Handoff supplies the token inventory, component state gallery, navigation map, and screenshots at agreed reference sizes.
