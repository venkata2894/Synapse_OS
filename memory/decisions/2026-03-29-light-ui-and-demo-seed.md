# Decision Record

- Date: 2026-03-29
- Owner: Codex
- Context: The frontend needed a more elegant light theme, better screen-fit behavior, and seeded system data so manual review was meaningful from first run.
- Decision: Adopted a light design token application across the UI, tightened responsive layout constraints to prevent page-level horizontal overflow, and added startup demo-data seeding behind `SENTIENTOPS_SEED_DEMO_DATA`.
- Alternatives Considered: Keeping dark theme and requiring manual data entry through Tool Console for every verification cycle.
- Consequences: Manual product walkthroughs now show realistic cross-page state immediately; tests remain deterministic by skipping auto-seed during pytest.
- Follow-up Actions: Replace in-memory repository with persistent storage while preserving seeded fixtures as optional dev bootstrap data.
