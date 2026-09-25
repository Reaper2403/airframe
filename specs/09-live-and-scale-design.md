# M09 — Live bridge and scale: deferred engineering design

This module is a future boundary, not an initial implementation requirement or a claim that the supplied dataset is live. The present capture set cannot establish 5,000-client capacity, forecast accuracy, measured factory locations or production savings.

## Prerequisites

Before enabling live mode, obtain authorized sensor feeds, controller/AP inventory, deployment constraints, time-synchronization measurements, retention policy, authentication/authorization requirements and an operational owner. Before spatial claims, obtain a verified floor plan, coordinate reference, physical AP/sensor placements and uncertainty/maintenance process. Before economic claims, obtain incident-to-line attribution and actual interruption evidence.

## Adapter boundary

A live adapter emits the same versioned Observation semantics as M01, plus ingestion time, source session identity, monotonic source sequence where available, sensor heartbeat, drop counters, clock measurements and gap notices. Capture-origin frame identity must remain stable across retries and reconnects. File replay and live adapters never share a misleading origin label.

Preserve raw arrival order and recorded event time separately. Define allowed lateness and watermark policy from measured deployment behavior, not an assumed fixed constant. Late events append revisions; they cannot silently rewrite what the operator knew at a prior cutoff. Record the policy version and distinguish provisional from finalized windows. Reconnection detects gaps and duplicates; no data is not a healthy network.

## Delivery and backpressure

Use bounded queues, durable ingestion/checkpoints where required, idempotent writes and explicit lag/drop metrics. UI updates may coalesce, but evidence ingestion must never silently sample records used in counts. If overload requires shedding data, publish a gap record and downgrade completeness. A client reconnect resumes from an acknowledged cursor or explicitly requests a fresh snapshot. Snapshot and subsequent updates must have a gap-free version boundary.

Separate ingestion health, source observation coverage and diagnosed wireless behavior. A missing heartbeat indicates feed uncertainty; a quiet RF channel is not equivalent. Clock trust includes measurement method, bound, sample time and expiry; expired measurements revert to unknown rather than persisting false certainty.

## Storage and operational boundaries

Keep immutable observations separate from derived signals/revisions and user annotations. Partition by dataset/session, source and time; index client/BSSID/type/time for evidence retrieval. Keep raw identity mapping restricted with audited access. Define retention and deletion consistently across raw capture, normalized evidence, indexes, exports and backups before deployment. Redact sensitive identifiers from service logs.

Production requires authenticated sessions, least-privilege access, read-only diagnostic roles, authorized plan editing, transport encryption, backup/restore testing, audit records and secrets management. A local demo is not proof these controls exist. Any later controller-write capability needs a separate approved contract, human approval and rollback; it is excluded here.

## Performance qualification

The initial dataset is roughly 1.12 million observations over 30 minutes, but this is not a representative production throughput guarantee. Establish target sustained and burst packet rates, concurrent users, retention duration and hardware before selecting infrastructure. Load-test peak distributions and reconnect storms, not just average rate or nominal client count.

Measure ingest-to-visible latency percentiles, durable-write lag, queue depth, query latency, memory, dropped records, checkpoint recovery time and replay equivalence. Keep empirical results separate from targets. A proposed initial UX target is subsecond visible updates and under-one-second indexed evidence-page retrieval on documented hardware; it is a design target pending measurement, not a current capability.

## Predictive intelligence gate

Do not ship dead-zone prediction from this dataset. It lacks verified spatial trajectories, ground-truth service outcomes and known measurement coverage. Future predictors require independent temporal train/validation splits, labeled outcomes, leakage tests, calibrated uncertainty, false-alarm budgets, drift monitoring and a rules-based fallback. Start with interpretable online statistics described in M03. A model cannot upgrade missing evidence into certainty.

## Exit criteria

Live mode stays disabled until feed provenance, reconnect/gap handling, measured clock policy, capacity tests, security review and replay/live semantic equivalence pass. Deliver an architecture decision record, deployment threat model, measured load report, recovery runbook, retention policy and explicit remaining limitations. None of these prerequisites should delay the honest offline demo.
