# Investigation refinements and incident report verification — 26 September 2026

## Delivered

UX, product-management and SDE agents implemented and reviewed the network engineer's requested improvements. Investigation now exposes sortable client cohorts, first-observed admission ranks, selectable reason onset/cadence, observed protocol groups, per-client attempt/segment timelines, same-interface peers, shared-scale reason transitions, discovery trends and parsed EAP identifiers. Missing joins and observation boundaries remain explicit; every attempt page is reachable. Advertised security profiles are unavailable in the published input, so protocol cohorts are labeled as observed behavior rather than configuration.

The incident-report dialog calls a local server using the existing Ripple credential file. Credentials remain server-side and are not copied into browser assets. The server verifies and recomputes scoped evidence, calls OpenAI, validates structured findings and references, then generates a one-page PDF with the exact evidence packet saved alongside it. Physical causes and application downtime are not inferred as measured facts.

## Checks executed

- The full automated suite passed 66/66 before the final bounded-shortening test was added. The final incident-report suite passed 7/7, including that new test and the selected-focus catalog assertions: 67 distinct passing checks across these runs.
- Verified data tests include timestamp/release-ordinal replay, evidence integrity, same-BSSID counterexamples, admission-order denominators, attempt pagination, parsed EAP fields and a bounded analysis packet.
- Report tests cover strict schema, isolated engineer notes, credential isolation, canonical server recomputation, stale evidence rejection, unsupported references, word budgets, one bounded shortening pass, expired credentials, refusals, incomplete responses, rate limits and network errors.
- Browser verification used the supported in-app browser. EAP cohort ranks, selectable termination reason, C-004 same-interface peers, parsed EAP attempt records, orphan segments and the final page of 102 segments were checked. Actual report generation returned three findings and PDF/JSON links. The mobile report and diagnostic controls fit a 390-pixel viewport with internal table scrolling. The final refreshed page has compact control IDs (maximum 31 characters), the report entry point and no document-width overflow.
- The reusable standalone Playwright UI script was not executed; browser checks were performed directly through computer-use tools.
- HTTP checks rejected invalid bodies and foreign origins, kept the environment file inaccessible and served generated report artifacts. Public/report text scans found no API-key matches.

## Live output

The updated Ripple credential successfully generated a real report with `gpt-5.6-terra`, retaining the response ID, usage, model, exact packet and evidence hash. The delivered reviewed PDF is `../../outputs/Airframe_Incident_Report_One_Page.pdf`; its companion is `../../outputs/Airframe_Incident_Report_Evidence.json`.

Product review checked the admission-order relationship, the reason-23-to-reason-2 transition and the same-interface peer/cadence comparison. Two phrases were editorially corrected to say successful association responses continued, avoiding an unsupported claim of the specific Wi-Fi Reassociation exchange or roaming. No numerical findings changed. The companion JSON preserves the original model report and an explicit editorial change record; the original generated snapshot remains unchanged.

The delivered PDF was counted with pypdf (exactly one page), rendered with Poppler and visually inspected for readable type, complete text, evidence references and an unobstructed footer. It contains three evidence-backed relationships, brief significance, alternative explanations and discriminating next checks. The preview server was restarted with the final focus-aware prompt and terminology guidance.

## Practical limits

This is a local historical/replay investigation tool, not a production streaming service. The evidence does not establish a microwave, movement, a faulty physical AP, AAA root cause or factory downtime. Cross-source timing and capture completeness remain unvalidated. Reference validation constrains report grounding but does not independently prove every model assertion; engineering review is still required.
