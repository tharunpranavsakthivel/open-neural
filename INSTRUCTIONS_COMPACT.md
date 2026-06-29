# INSTRUCTIONS.compact.md — Kilo Code Agent Rules

Purpose: enforce reliable, secure, testable, production-aware work by AI coding agents in this repository.

---

## 0. Prime Directive

Deliver complete, working, verified changes. Do not claim completion until the result has been tested end-to-end in the project context.

Core rule: **plan → inspect → implement → validate → summarize**.

---

## 1. Task Execution Protocol

Before non-trivial work:
- State a brief plan, files likely affected, assumptions, and validation strategy.
- Read the relevant surrounding code before editing.
- Scan top-level structure, README, existing `INSTRUCTIONS.md`, `CONTRIBUTING.md`, `.cursorrules`, and config files when entering a new repo.
- Clarify only when the task is materially ambiguous, missing required details, or could waste significant effort if interpreted wrongly.

During work:
- Break complex tasks into sequential subtasks.
- Keep scope tight. Do not refactor unrelated code.
- Preserve existing naming, formatting, architecture, and conventions.
- Stop and report unexpected failures, wrong assumptions, or blockers before improvising.
- Do not leave permanent `TODO`, `FIXME`, or `HACK` comments. Track incomplete work explicitly.

After work:
- Run relevant tests, type checks, lint, and build commands.
- Report what changed, what was not done, validation performed, and any follow-ups.

---

## 2. Code Quality Standards

General:
- Follow the project’s existing style guide; otherwise use the community standard.
- Use clear, meaningful names. Avoid non-standard abbreviations.
- Keep functions focused, short, and shallow. Prefer guard clauses over nesting.
- Prefer idempotent functions.
- Avoid boolean behavior flags; split into named functions or strategies.
- Delete dead code instead of commenting it out.
- Avoid premature abstraction. Abstract only after repeated stable patterns emerge.

Comments and docs:
- Every file needs a top-level docblock explaining purpose, exports, dependencies, and side effects.
- Every function, method, and class needs a docstring/block comment covering:
  - Purpose
  - Parameters and types
  - Return value and type
  - Exceptions, edge cases, and complexity when relevant
- Inline comments explain **why**, not **what**.
- External API call sites must document endpoint purpose, expected response shape, failure handling, and retry policy.
- Architectural tradeoffs go in ADRs under `docs/adr/NNN-short-title.md` with `Status`, `Context`, `Decision`, `Consequences`.

---

## 3. Error Handling

- Wrap every external call: filesystem, network, database, subprocess, external service.
- Validate all user/external input at system boundaries.
- Use domain-specific exceptions, not bare `Exception`/`Error`.
- Never swallow exceptions with empty `except`/`catch`.
- Error messages must include what failed, why if known, and how to resolve it.
- Attach sanitized context: operation, IDs, request/correlation ID, and relevant inputs.
- Retry only idempotent operations. Use capped exponential backoff with jitter.
- Use circuit breakers for unreliable external services.

---

## 4. Testing Requirements

- Every new function, class, and module needs unit tests.
- Tests live in `test/` at repo root, mirroring source structure.
- Tests must be isolated, deterministic, fast, and avoid real network/database calls.
- Cover happy path, edge cases, boundary values, and known failure modes.
- Bug fixes require a regression test that fails before the fix and passes after.
- Do not modify tests just to make them pass unless the test is provably wrong.
- Prefer property-based tests for large or complex input spaces.
- New code should meet at least 80% line coverage.
- Existing tests must pass before and after the change.

---

## 5. Project and File Organization

- Follow existing directory structure. Do not add top-level directories without approval.
- One module, one responsibility.
- Put shared utilities, constants, and types in dedicated modules.
- Prefer feature-based grouping when no convention exists.
- Avoid excessive nesting beyond 3–4 levels.
- Python packages need `__init__.py` unless namespace packages are explicitly used.
- Update `.gitignore` when new local/generated artifacts are introduced.

---

## 6. Version Control Hygiene

- Make atomic changes only.
- Do not modify unrelated files.
- Do not commit generated artifacts, secrets, or editor-specific files unless intentionally part of the repo.
- Never commit directly to `main`/`master`.
- Commit format:
  ```text
  <type>(<scope>): <short summary>
  ```
  Valid types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `style`.
- If auth/authorization logic changes, call it out in the commit and request review.

---

## 7. Security Rules

- Never hardcode or log secrets, credentials, tokens, passwords, or PII.
- Validate and sanitize input before SQL, shell commands, file paths, and template rendering.
- Use parameterized queries or an ORM. Never interpolate SQL strings.
- Use vetted cryptography only. Never implement custom crypto.
- Apply least privilege.
- Set explicit CORS policies.
- Prefer maintained dependencies with clear licensing; flag CVEs before adding packages.
- Access secrets through a typed config layer, not scattered raw environment reads.

---

## 8. Dependency Management

- Do not add dependencies without explaining why existing tooling is insufficient.
- Prefer standard library/native APIs for simple tasks.
- Pin dependency versions in lock files or pinned manifests.
- Separate runtime and dev dependencies.
- Before removing a dependency, verify it is unused.
- Check dependency trees for bloat, license issues, and CVEs.
- Run dependency scans such as `npm audit`, `pip-audit`, or equivalent before introducing packages.

---

## 9. Configuration and Environment

- Load environment-specific configuration from environment variables or a secrets manager.
- `.env` is for local development only and must be ignored by Git.
- Provide `.env.example` with documented variables, expected formats, and source of values.
- Validate config at startup and fail fast on missing/malformed values.
- Group config by concern: database, external services, feature flags, runtime tuning.
- Do not log config values. Log only successful loading and active environment profile.
- Feature flags must be config-driven and removed when permanently enabled.

---

## 10. Type Safety and Schemas

Python:
- Type-hint all new function signatures and class attributes.
- Run `mypy` or `pyright` in strict mode.
- Any `type: ignore` needs a justification comment.

TypeScript:
- `strict: true` is required.
- Avoid `any`; prefer `unknown` and narrow explicitly.
- Any unavoidable `any` requires an inline justification.

Schemas:
- Validate API bodies, external responses, file reads, and database results with Pydantic, Zod, or equivalent.
- Use named models/types instead of raw `dict`/`object` for structured data.
- Use enums for finite closed sets.
- Update downstream consumers in the same PR as schema changes.

---

## 11. API Design Standards

- Version all APIs from day one: `/v1/`, `/v2/`.
- Do not introduce breaking changes to an existing version.
- Use correct HTTP status codes:
  - `200` successful GET/PUT/PATCH
  - `201` created POST with `Location`
  - `204` successful DELETE/action with no body
  - `400` invalid input
  - `401` unauthenticated
  - `403` unauthorized
  - `404` not found
  - `409` conflict
  - `422` semantic validation failure
  - `429` rate limit with `Retry-After`
  - `500` server failure
- Use a consistent error envelope:
  ```json
  {
    "error": {
      "code": "VALIDATION_FAILED",
      "message": "Human-readable description.",
      "details": [],
      "request_id": "abc-123"
    }
  }
  ```
- Paginate all list endpoints.
- Mutation endpoints should accept `Idempotency-Key` where relevant.
- Maintain and update OpenAPI/Swagger specs in the same PR.
- Rate limit public and authenticated endpoints.

---

## 12. Database and Migration Safety

- Never modify production schema directly.
- Use versioned migrations with tested rollback paths.
- Do not run schema changes from application startup code.
- Before migrations, identify backfills, live-safety, and runtime impact.
- Use non-locking strategies for long-running migrations where supported.
- Index all foreign keys.
- Enforce invariants with database constraints, not only app logic.
- Use two-phase removal for columns/tables:
  1. Stop writing/reading in app code.
  2. Remove schema in a later deployment.
- Document entity relationships, indexes, and constraints in `docs/schema.md`.

---

## 13. Observability and Logging

- Use structured JSON logs, not `print()` in production.
- Each log needs: `timestamp`, `level`, `module/logger`, `message`.
- Request-scoped logs need `request_id` or `correlation_id`.
- Use log levels correctly:
  - `DEBUG`: internal detail
  - `INFO`: normal operations
  - `WARNING`: recoverable anomaly
  - `ERROR`: failure requiring attention
  - `CRITICAL`: integrity or urgent system failure
- Never log secrets or PII.
- Log full stack traces when catching and re-raising.
- Expose `/health` returning dependency status without auth.
- Instrument major feature paths with latency/timing metrics.

---

## 14. Performance and Concurrency

Performance:
- Measure before optimizing.
- Document time and space complexity for non-trivial algorithms.
- Avoid N+1 queries; use batching, joins, or eager loading.
- Use pagination, streaming, or chunking for large data.
- Cache only with documented invalidation strategy.
- Close files, DB connections, and clients explicitly.

Async/concurrency:
- Never run blocking I/O inside `async` functions.
- Use async equivalents or thread/process pools.
- Document shared mutable state, ownership, protection, and failure modes.
- Keep lock scope narrow; do not hold locks during I/O or long computation.
- Prefer immutable shared data.
- Background workers need bounded concurrency, per-task error handling, and graceful shutdown.
- Avoid `asyncio.gather(..., return_exceptions=False)` unless one failure should cancel siblings.
- Do not call `asyncio.run` inside an active event loop.

---

## 15. Frontend Accessibility

- All interactive elements need ARIA labels/roles and keyboard navigation.
- Do not rely on color alone; pair with labels, icons, or patterns.
- Meet WCAG AA contrast: 4.5:1 normal text, 3:1 large text.
- Images need descriptive `alt`; decorative images use `alt=""`.
- Focus order must be logical.
- Do not remove focus outlines without an equivalent indicator.
- Inputs need explicit labels or `aria-label`. Placeholder is not a label.
- Test keyboard navigation before completion.

---

## 16. LLM and AI Pipeline Standards

- Version prompt templates like source code.
- Define eval criteria and baseline before building LLM features.
- Pin exact model versions; do not use mutable aliases.
- Set `max_tokens` on every call and document the budget.
- Treat LLM output as untrusted. Validate structured outputs with Pydantic/Zod before use.
- Never use raw LLM output in security-critical paths.
- Defend against prompt injection by clearly delimiting user content.
- RAG context must be traceable: log document ID, chunk ID, and retrieval score.
- Log model parameters, latency, token usage, and raw responses in dev/staging; sample safely in production.
- Document per-request token cost estimate and alert on >2× observed usage.
- Define failure behavior: retry, degraded response, or fail fast.

---

## 17. Destructive Operation Protocol

For any irreversible delete, truncate, drop, schema change, infrastructure change, or destructive file operation:

1. Run a dry-run first and show exactly what would be affected.
2. Require explicit user confirmation.
3. State rollback strategy. If none exists, say so.
4. Create a backup/checkpoint where feasible and document the location.
5. Scope the operation as narrowly as possible.
6. Log confirmer, timestamp, scope, and outcome to an append-only audit log.

Prefer soft deletion for user-facing data unless hard deletion is required.

---

## 18. Self-Correction and Recovery

- Stop on unexpected failures.
- Do not silently retry destructive operations.
- Investigate failing tests before changing them.
- Roll back completed steps when possible after cascade failure.
- Declare wrong assumptions explicitly.
- After failure, report:
  - What was attempted
  - What failed and the error
  - Current system state
  - What must happen next

---

## 19. CI/CD

- CI must pass before completion: lint, type check, tests, build.
- Add new local checks to CI in the same PR.
- Store environment-specific config in CI/CD secrets, never workflow files.
- Broken CI takes priority over feature work.
- Build artifacts must be reproducible.
- Tag and sign release artifacts.
- Document CI topology in README or `docs/ci.md`.

---

## 20. README Requirements

Every README must include:
- Project purpose
- Local setup steps
- Environment variables, referencing `.env.example`
- How to run tests
- How to run the application
- CI/CD overview or link to `docs/ci.md`

A README that requires tribal knowledge has failed.

---

## 21. Completion Checklist

Before marking work complete:

Correctness:
- [ ] Task fully completed or scoped reduction clearly stated.
- [ ] Output verified end-to-end.
- [ ] Assumptions documented.
- [ ] No silent failures.

Code quality:
- [ ] Files/functions/classes documented.
- [ ] Comments explain reasoning.
- [ ] No dead code, unused imports, or permanent TODO/FIXME/HACK.
- [ ] Scope stayed focused.

Safety:
- [ ] No hardcoded secrets or PII leaks.
- [ ] Inputs validated.
- [ ] SQL parameterized/ORM-based.
- [ ] Destructive protocol followed where relevant.

Errors:
- [ ] External calls handled.
- [ ] Retry policy capped and documented.
- [ ] Errors are actionable.
- [ ] No empty catch/except blocks.

Testing:
- [ ] Unit tests added/updated.
- [ ] Edge/failure cases covered.
- [ ] Regression test added for bug fixes.
- [ ] Existing tests still pass.
- [ ] CI passes cleanly.

Types/schemas:
- [ ] Python/TS strict typing followed.
- [ ] External data validated.
- [ ] Enums used for closed sets.
- [ ] Schema consumers updated.

Database/API:
- [ ] Migrations versioned with rollback.
- [ ] Foreign keys indexed.
- [ ] APIs versioned and paginated.
- [ ] OpenAPI updated.

LLM:
- [ ] Prompt/model version pinned.
- [ ] `max_tokens` set.
- [ ] Output schema-validated.
- [ ] Prompt injection defenses applied.
- [ ] Retrieval trace logged.

Observability:
- [ ] Structured logs used.
- [ ] Request/correlation IDs included.
- [ ] `/health` present.
- [ ] No secrets/PII in logs.

Dependencies:
- [ ] New dependencies justified.
- [ ] Versions pinned.
- [ ] Audits run.
- [ ] Runtime/dev deps separated.

Version control:
- [ ] No unrelated files changed.
- [ ] Commit message format followed.
- [ ] No generated files/secrets committed.
- [ ] `.gitignore` updated if needed.

Frontend:
- [ ] ARIA and keyboard support present.
- [ ] Contrast meets WCAG AA.
- [ ] Labels and alt text included.

CI/CD:
- [ ] CI updated for new checks.
- [ ] No hardcoded env config.
- [ ] Build reproducible.

---

## Final Rule

A change is not done because code was written.  
A change is done when the repository is in a clean, tested, documented, secure, and reviewable state.