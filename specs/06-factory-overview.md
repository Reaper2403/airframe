# M06 — Factory overview

Reference: [approved overview](../design-concepts/01-factory-overview.png). Dependencies: M04 projections and M05 primitives. Do not implement inference, replay, or coordinate estimation here.

## Composition

At desktop width, allocate approximately 72% to the architectural floor and 28% to “Needs attention.” Use a compact title/context band, expansive floor canvas, incident rail with selected summary, and bottom capture-source strip. Keep the illustration detailed but lower contrast than incident markers and text. Avoid KPI tiles above the map.

The layout is a deliberately authored LayoutManifest, not a reconstruction from telemetry. Use dimensionless coordinates within a declared illustrative bounds rectangle. Zones such as Assembly, Test, and Logistics are fictional context. Label the surface “Illustrative factory layout — locations unverified” persistently and include this in any exported image. No compass, meter scale, real site name, measured coverage contour, worker track, or real floor coordinates without a separately verified source.

AP aliases refer to logical BSSID contexts, not proven physical chassis. Store illustration placements separately from observations. A placement includes alias, dimensionless point, optional illustrative zone, and origin. Absence of a placement leaves the investigation in the rail; never create a measured-looking location silently.

## Screen binding

### Creative floor-design brief

The user explicitly permits a plausible designed workfloor rather than a deterministic reconstruction. Treat the approved image as the composition reference: assembly cells in the upper-left, testing in the upper-right, logistics below, loading/service access to the right, and connected circulation aisles. Add restrained architectural detail: robot-cell outlines, conveyors, storage racks, workstations, doors and service corridors. These are illustrative scene assets, not an inventory of actual factory equipment.

Use eight logical AP context markers as an illustrative arrangement consistent across all screens. Put the selected AP-04/client context near a central aisle to support the approved composition; this is a design choice, not a location inference. Keep placements stable across reloads, incident navigation and replay rather than randomly moving them. Source IDs S01–S08 must not be assumed colocated with similarly numbered APs. Channel observations do not provide physical adjacency or distance.

The default spatial treatment is a crisp top-down architectural plan with subtle depth, muted fine detail and strongly legible selected context. A soft amber region may highlight the selected illustrative area, but must not resemble a measured RF heatmap or be labeled a dead zone. Do not animate a worker route from packets; a future explicitly labeled scenario animation must remain outside the observed replay timeline.

Use the concise persistent label “Illustrative layout · placements estimated,” with an accessible explanation: “Factory geometry and device positions are designed for context; packet evidence does not establish physical locations.” This fulfills the layout-disclaimer requirement without repetitive chrome. More accurate supplied geometry can replace the illustration later without changing incident evidence or navigation contracts.

| Element | Binding | Honest behavior |
|---|---|---|
| Attention count | Eligible M04 investigation list | Identify curated subset when applicable; no claim it is every dataset issue |
| Card | Incident identity, client alias, state, eligible metrics | Hide endpoint/duration until released in replay |
| Selected marker/region | Illustrative placement associated with selected identity | Label “Illustrative incident placement”; no measured dead-zone assertion |
| Client/AP connector | Selected logical relationship | Decorative relationship only; never a walking path |
| Summary | Current incident revision | Evidence grade and unresolved cause visible |
| Source strip | CaptureSource manifest | “8 capture files loaded”; channels 36, 40, 44, 48, 149, 153, 157, 161 respectively |
| Trust notice | Manifest trust limitations | “Sensor health unavailable” and “Cross-source clock alignment unverified” |

Nonselected APs use neutral symbols. Only an eligible incident association creates attention styling. Never paint every AP amber because the reference drawing does. Offline files do not produce online/offline dots.

## Interaction specification

Selecting a rail card updates the selected summary and illustrative highlight without navigating. Its explicit “Open investigation” control navigates to M07. A direct open control on each card may perform the same navigation in one selection. Clicking an AP marker opens a lightweight context panel listing related eligible incidents; empty AP contexts say no matching investigation, not healthy.

The default historical demo selection is AF-104. Selection is always distinguishable from status through border and label. Pan/zoom affects only the floor viewport and is bounded; provide zoom in/out and reset controls. Selection does not unexpectedly reset user zoom. Keyboard users can bypass the drawing and use the same incident list. Markers have accessible names identifying alias and illustrative placement.

Filtering supports client alias, AP alias, observed state and source involvement. Filters operate on service projections, not hand-coded card arrays. Show active-filter count and clear-all. Preserve selection if still eligible; otherwise select none and explain why. A replay seek before an incident removes its card and highlight and shows the prefix-empty state.

## Content and edge cases

AF-104 uses the ledger’s 12:25 timestamps and 13.127 s recorded deauth-to-association interval in historical review. Its title may be “Disconnect and association,” with cause unresolved. Do not imply application recovery through title or icon. Cards with unknown AP context remain navigable. Multiple incidents at one illustrative point use a grouped selector, not displaced markers suggesting new locations.

No incidents: retain layout and show “No investigations in this selection.” No layout: retain the full incident list and explain illustration unavailable. Loading: neutral geometry and rail skeletons. Projection error: retry rail independently without presenting stale metrics as current. Very many markers: cluster visually, retaining complete list access and no count loss.

## Acceptance and handoff

Verify AF-104 opens M07 with identical revision/context; no raw addresses appear; all source channels match manifest; the illustration disclaimer remains visible at every viewport; changing positions cannot change incident lists or grades; no future incident survives a seek; all map actions have list equivalents. Deliver layout manifest, placement-origin audit, responsive screenshots, and interaction tests. Decorative artwork may be elaborate, but it must remain independent of evidence and fully labeled.
