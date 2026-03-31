# Decision Record

- Date: 2026-03-31
- Owner: Codex
- Context: SentientOps needed a realistic agent-first UAT layer that could exercise the current stack as both an end user and an autonomous agent without introducing a parallel fake environment.
- Decision: Added a new `apps/tester` Python package built on the OpenAI Agents SDK with a `UAT Director` orchestration model, specialist agents for environment/workflow/browser/integration testing, Playwright-backed browser tools, MCP smoke coverage, and durable JSON/Markdown reports under `reports/uat/`.
- Alternatives Considered: Writing only deterministic integration tests, using browser automation without OpenAI agents, or creating a separate seeded QA database disconnected from the main local dataset.
- Consequences: The repository now has a reusable agent-native UAT harness that can generate realistic operator reports; successful execution depends on a configured OpenAI API key, an agent API key, live local services, and Playwright browser installation.
- Follow-up Actions: Run the harness against a live stack, materialize outbox worker follow-through for evaluation and memory jobs, and feed the generated UAT artifacts into CI or release-readiness reviews.
