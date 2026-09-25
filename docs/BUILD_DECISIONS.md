# AIRFRAME build decisions

The user authorized implementation on 2026-09-25 with three workers and one integration tester. The root agent is the integration tester; workers own data/service, factory/design system, and investigation/action screens. This supersedes the documentation-only phase without enabling network-infrastructure changes.

Preserve the existing static deployment architecture. Use native browser ES modules and semantic HTML; no competing framework migration is needed. One shared application clock and service boundary coordinate all screens. Live ingestion remains deferred under M09. Raw captures and restricted mappings remain local. The published data bundle is explicitly scoped to complete curated investigation membership; full normalized records are maintained locally.

The integrated test suite must enumerate every rendered interactive component, exercise representative states of each component and every primary journey, and record limitations rather than claiming exhaustive correctness. Do not publish legacy data containing raw identities alongside the new pseudonymized bundle.
